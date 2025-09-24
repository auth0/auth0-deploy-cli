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

type JSONApiResponseWithPage = JSONApiResponse<ApiResponse> & {
  response: {
    start: number;
    limit: number;
    total: number;
  };
};

const API_CONCURRENCY = 3;
// To ensure a complete deployment, limit the API requests generated to be 80% of the capacity
// https://auth0.com/docs/policies/rate-limits#management-api-v2
const API_FREQUENCY_PER_SECOND = 8;

const MAX_PAGE_SIZE = 100;

function getEntity(rsp: ApiResponse): Asset[] {
  // If the response is already an array, return it directly (v5 SDK behavior)
  if (Array.isArray(rsp)) {
    return rsp as Asset[];
  }

  // If the response is an object, look for array properties (legacy behavior)
  if (typeof rsp === 'object' && rsp !== null) {
    const found = Object.values(rsp).filter((a) => Array.isArray(a));
    if (found.length === 1) {
      return found[0] as Asset[];
    }
    // If we can't find exactly one array, but there's a property that looks like it contains the data
    // Try some common property names from Auth0 SDK v5
    if ('data' in rsp && Array.isArray(rsp.data)) {
      return rsp.data as Asset[];
    }
  }

  throw new Error('There was an error trying to find the entity within paginate');
}

function checkpointPaginator(
  client: Auth0APIClient,
  target,
  name: 'list'
): (arg0: CheckpointPaginationParams) => Promise<Asset[]> {
  return async function (...args: [CheckpointPaginationParams]) {
    const data: Asset[] = [];

    // remove the _checkpoint_ flag
    const { checkpoint, ...newArgs } = _.cloneDeep(args[0]);

    // Set appropriate page size for checkpoint pagination
    newArgs.take = newArgs.take || 50; // Default to 50

    let currentPage = await client.pool
      .addSingleTask({
        data: newArgs,
        generator: (requestArgs) => target[name](requestArgs),
      })
      .promise();

    // Add first page data
    data.push(...(currentPage.data || []));

    // Continue fetching while there are more pages
    while (currentPage.hasNextPage && currentPage.hasNextPage()) {
      const pageToFetch = currentPage; // Capture the current page reference
      currentPage = await client.pool
        .addSingleTask({
          data: null,
          generator: () => pageToFetch.getNextPage(),
        })
        .promise();

      data.push(...(currentPage.data || []));
    }

    return data;
  };
}

function pagePaginator(
  client: Auth0APIClient,
  target,
  name: 'list'
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
    const rsp: JSONApiResponseWithPage = await client.pool
      .addSingleTask({
        data: _.cloneDeep(newArgs),
        generator: (pageArgs) => target[name](...pageArgs),
      })
      .promise();

    data.push(...getEntity(rsp.data));
    // In Auth0 SDK v5, the total is not provided
    const total = rsp.response?.total || 0;

    // If total is 0 but we have data, it likely means the response doesn't include pagination info
    // In this case, we should assume this is all the data and skip pagination
    const initialDataLength = getEntity(rsp.data).length;
    if (total === 0 && initialDataLength > 0) {
      return data; // Return what we have without pagination
    }

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

      // Only validate total if it was provided (non-zero)
      // In Auth0 SDK v5,endpoints don't provide total count
      if (total > 0 && data.length !== total) {
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
      if (name === 'list') {
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
  // Create a new object that inherits from the original client
  const clientWithPooling = Object.create(Object.getPrototypeOf(client));

  // Copy all enumerable properties from the original client
  Object.assign(clientWithPooling, client);

  // Add the pool property
  clientWithPooling.pool = new PromisePoolExecutor({
    concurrencyLimit: API_CONCURRENCY,
    frequencyLimit: API_FREQUENCY_PER_SECOND,
    frequencyWindow: 1000, // 1 sec
  });

  return pagedManager(clientWithPooling as Auth0APIClient, clientWithPooling as Auth0APIClient);
}

// eslint-disable-next-line no-unused-vars
export async function paginate<T>(
  fetchFunc: (...paginateArgs: any) => any,
  args: PagePaginationParams | CheckpointPaginationParams
): Promise<T[]> {
  // override default <T>.list() behaviour using pagedClient
  const allItems = (await fetchFunc(args)) as unknown as T[];
  return allItems;
}
