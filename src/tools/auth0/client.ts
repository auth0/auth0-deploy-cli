import { PromisePoolExecutor } from 'promise-pool-executor';
import _ from 'lodash';

import { JSONApiResponse, ManagementClient } from 'auth0';
import { flatten } from '../utils';
import {
  Asset,
  ApiResponse,
  Auth0APIClient,
  CheckpointPaginationParams,
  PagePaginationParams,
} from '../../types';

const API_CONCURRENCY = 3;
// To ensure a complete deployment, limit the API requests generated to be 80% of the capacity
// https://auth0.com/docs/policies/rate-limits#management-api-v2
const API_FREQUENCY_PER_SECOND = 8;

const MAX_PAGE_SIZE = 100;

function getEntity(rsp: ApiResponse): Asset[] {
  const found = Object.values(rsp).filter((a) => Array.isArray(a));
  if (Array.isArray(found) && found.length === 1) {
    return found[0] as Asset[];
  }
  throw new Error('There was an error trying to find the entity within paginate');
}

function checkpointPaginator(
  client: Auth0APIClient,
  target,
  name: 'getAll'
): (arg0: CheckpointPaginationParams) => Promise<Asset[]> {
  return async function (...args: [CheckpointPaginationParams]) {
    const data: Asset[] = [];

    // remove the _checkpoint_ flag
    const { checkpoint, ...newArgs } = _.cloneDeep(args[0]);

    // fetch the total to validate records match
    const { total } = await client.pool
      .addSingleTask({
        data: newArgs,
        generator: (requestArgs) => target[name](requestArgs),
      })
      .promise();

    let done = false;
    // use checkpoint pagination to allow fetching 1000+ results
    newArgs.take = 50;

    while (!done) {
      const rsp = await client.pool
        .addSingleTask({
          data: newArgs,
          generator: (requestArgs) => target[name](requestArgs),
        })
        .promise();

      data.push(...getEntity(rsp));
      if (!rsp.next) {
        done = true;
      } else {
        newArgs.from = rsp.next;
      }
    }

    if (data.length !== total) {
      throw new Error('Fail to load data from tenant');
    }

    return data;
  };
}

function pagePaginator(
  client: Auth0APIClient,
  target,
  name: 'getAll'
): (arg0: PagePaginationParams) => Promise<Asset[]> {
  return async function (...args: [PagePaginationParams]): Promise<Asset[]> {
    // Where the entity data will be collected
    const data: Asset[] = [];

    // Create new args and inject the properties we require for pagination automation
    const newArgs = [...args];
    newArgs[0] = { ...newArgs[0], page: 0 };

    // Grab data we need from the request then delete the keys as they are only needed for this automation function to work
    const perPage = newArgs[0].per_page || MAX_PAGE_SIZE;
    newArgs[0].per_page = perPage;
    delete newArgs[0].paginate;

    // Run the first request to get the total number of entity items
    const rsp: JSONApiResponse<ApiResponse> = await client.pool
      .addSingleTask({
        data: _.cloneDeep(newArgs),
        generator: (pageArgs) => target[name](...pageArgs),
      })
      .promise();

    data.push(...getEntity(rsp.data));
    const total = rsp.data?.total || 0;
    const pagesLeft = Math.ceil(total / perPage) - 1;
    // Setup pool to get the rest of the pages
    if (pagesLeft > 0) {
      const pages = await client.pool
        .addEachTask({
          data: Array.from(Array(pagesLeft).keys()),
          generator: (page) => {
            const pageArgs = _.cloneDeep(newArgs);
            pageArgs[0].page = page + 1;

            return target[name](...pageArgs).then((r) => getEntity(r.data));
          },
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
function pagedManager(client: Auth0APIClient, manager: Auth0APIClient) {
  return new Proxy<Auth0APIClient>(manager, {
    get: function (target: Auth0APIClient, name: string, receiver: unknown) {
      if (name === 'getAll') {
        return async function (...args: [CheckpointPaginationParams | PagePaginationParams]) {
          switch (true) {
            case args[0] && typeof args[0] === 'object' && args[0].checkpoint:
              return checkpointPaginator(
                client,
                target,
                name
              )(...(args as [CheckpointPaginationParams]));
            case args[0] && typeof args[0] === 'object' && args[0].paginate:
              return pagePaginator(client, target, name)(...(args as [PagePaginationParams]));
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
    },
  });
}

// Warp around the ManagementClient and detect when requesting specific pages to return all
export default function pagedClient(client: ManagementClient): Auth0APIClient {
  const clientWithPooling: Auth0APIClient = {
    ...client,
    pool: new PromisePoolExecutor({
      concurrencyLimit: API_CONCURRENCY,
      frequencyLimit: API_FREQUENCY_PER_SECOND,
      frequencyWindow: 1000, // 1 sec
    }),
  } as Auth0APIClient;

  return pagedManager(clientWithPooling, clientWithPooling);
}

// eslint-disable-next-line no-unused-vars
export async function paginate<T>(
  fetchFunc: (...paginateArgs: any) => any,
  args: PagePaginationParams
): Promise<T[]> {
  // override default <T>.getAll() behaviour using pagedClient
  const allItems = (await fetchFunc(args)) as unknown as T[];
  return allItems;
}
