import { getStandardTests } from '../../utils';

import clientGrantsTestSpec from './clientGrants.spec';
import clientsTestSpec from './clients.spec';
import connectionsTestSpec from './connections.spec';

const testSpecs = [
  clientGrantsTestSpec,
  clientsTestSpec,
  connectionsTestSpec
];


testSpecs.forEach((spec) => {
  describe(`resource ${spec.handlerType}`, () => {
    spec.formats.forEach((format) => {
      getStandardTests(format).forEach((test) => {
        it(test.name, async () => {
          await test.func(format, spec);
        });
      });
    });
  });
});
