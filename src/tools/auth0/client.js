import { PromisePoolExecutor } from 'promise-pool-executor';
import _ from 'lodash';

import { flatten } from '../utils';

const API_CONCURRENCY = 3;
// To ensure a complete deployment, limit the API requests generated to be 80% of the capacity
// https://auth0.com/docs/policies/rate-limits#management-api-v2
const API_FREQUENCY_PER_SECOND = 8;

const MAX_PAGE_SIZE = 100;

function getEntity(rsp) {
  const found = Object.values(rsp).filter((a) => Array.isArray(a));
  if (found.length === 1) {
    return found[0];
  }
  throw new Error(
    'There was an error trying to find the entity within paginate'
  );
}

function checkpointPaginator(client, target, name) {
  return async function(...args) {
    const data = [];

    // remove the _checkpoint_ flag
    const { checkpoint, ...newArgs } = _.cloneDeep(args[0]);

    // fetch the total to validate records match
    const { total } = await client.pool
      .addSingleTask({
        data: newArgs,
        generator: target[name]
      })
      .promise();

    let done = false;
    // use checkpoint pagination to allow fetching 1000+ results
    newArgs.take = 50;

    while (!done) {
      const rsp = await client.pool
        .addSingleTask({
          data: newArgs,
          generator: target[name]
        })
        .promise();

      const entities = getEntity(rsp);

      if (entities.length === 0) {
        done = true;
      } else {
        data.push(...entities);
        newArgs.from = rsp.next;
      }
    }

    if (data.length !== total) {
      throw new Error('Fail to load data from tenant');
    }

    return data;
  };
}

function pagePaginator(client, target, name) {
  return async function(...args) {
    // Where the entity data will be collected
    const data = [];

    // Create new args and inject the properties we require for pagination automation
    const newArgs = [ ...args ];
    newArgs[0] = { ...newArgs[0], page: 0 };

    // Grab data we need from the request then delete the keys as they are only needed for this automation function to work
    const perPage = newArgs[0].per_page || MAX_PAGE_SIZE;
    newArgs[0].per_page = perPage;
    delete newArgs[0].paginate;

    // Run the first request to get the total number of entity items
    const rsp = await client.pool
      .addSingleTask({
        data: _.cloneDeep(newArgs),
        generator: (pageArgs) => target[name](...pageArgs)
      })
      .promise();

    data.push(...getEntity(rsp));
    const total = rsp.total || 0;
    const pagesLeft = Math.ceil(total / perPage) - 1;
    // Setup pool to get the rest of the pages
    if (pagesLeft > 0) {
      const pages = await client.pool
        .addEachTask({
          data: Array.from(Array(pagesLeft).keys()),
          generator: (page) => {
            const pageArgs = _.cloneDeep(newArgs);
            pageArgs[0].page = page + 1;

            return target[name](...pageArgs).then((r) => getEntity(r));
          }
        })
        .promise();

      data.push(...flatten(pages));

      if (data.length !== total) {
        throw new Error('Fail to load data from tenant');
      }
    }
    return data;
  };
}

// Warp around a <resource>Manager and detect when requesting specific pages to return all
function pagedManager(client, manager) {
  return new Proxy(manager, {
    get: function(target, name, receiver) {
      if (name === 'getAll') {
        return async function(...args) {
          switch (true) {
            case args[0] && typeof args[0] === 'object' && args[0].checkpoint:
              return checkpointPaginator(client, target, name)(...args);
            case args[0] && typeof args[0] === 'object' && args[0].paginate:
              return pagePaginator(client, target, name)(...args);
            default:
              return target[name](...args);
          }
        };
      }

      const nestedManager = Reflect.get(target, name, receiver);

      if (typeof nestedManager === 'object' && nestedManager !== null) {
        return pagedManager(client, nestedManager);
      }

      return nestedManager;
    }
  });
}

// Warp around the ManagementClient and detect when requesting specific pages to return all
export default function pagedClient(client) {
  client.pool = new PromisePoolExecutor({
    concurrencyLimit: API_CONCURRENCY,
    frequencyLimit: API_FREQUENCY_PER_SECOND,
    frequencyWindow: 1000 // 1 sec
  });

  return pagedManager(client, client);
}
