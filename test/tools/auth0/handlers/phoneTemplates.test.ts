import { expect } from 'chai';

import phoneTemplatesHandler from '../../../../src/tools/auth0/handlers/phoneTemplates';

const mockTemplates = {
  templates: [
    {
      id: 'pntm_1234567890',
      type: 'otp_verify',
      disabled: false,
      content: {
        syntax: 'liquid',
        from: '+15551234567',
        body: {
          text: 'Your verification code is {{ code }}',
          voice: 'Your verification code is {{ code }}',
        },
      },
    },
    {
      id: 'pntm_0987654321',
      type: 'otp_enroll',
      disabled: false,
      content: {
        syntax: 'liquid',
        from: '+15551234567',
        body: {
          text: 'Your enrollment code is {{ code }}',
          voice: 'Your enrollment code is {{ code }}',
        },
      },
    },
  ],
};

const mockPool = {
  addEachTask: function (data) {
    return {
      promise: () => Promise.all(data.data.map(data.generator)),
    };
  },
};

describe('#phoneTemplates handler', () => {
  describe('#phoneTemplates getType', () => {
    it('should get phoneTemplates', async () => {
      const auth0 = {
        branding: {
          phone: {
            templates: {
              list: () => Promise.resolve(mockTemplates),
            },
          },
        },
      };

      const handler = new phoneTemplatesHandler({ client: auth0 });
      const data = await handler.getType();

      expect(data).to.deep.equal(mockTemplates.templates);
    });

    it('should return empty array if there are no phone templates', async () => {
      const auth0 = {
        branding: {
          phone: {
            templates: {
              list: () => Promise.resolve({ templates: [] }),
            },
          },
        },
      };

      const handler = new phoneTemplatesHandler({ client: auth0 });
      const data = await handler.getType();

      expect(data).to.deep.equal([]);
    });

    it('should return empty array if templates is undefined', async () => {
      const auth0 = {
        branding: {
          phone: {
            templates: {
              list: () => Promise.resolve({}),
            },
          },
        },
      };

      const handler = new phoneTemplatesHandler({ client: auth0 });
      const data = await handler.getType();

      expect(data).to.deep.equal([]);
    });

    it('should fail for unexpected api errors', async () => {
      const auth0 = {
        branding: {
          phone: {
            templates: {
              list: () => Promise.reject(new Error('Unexpected API error')),
            },
          },
        },
      };

      const handler = new phoneTemplatesHandler({ client: auth0 });

      try {
        await handler.getType();
      } catch (error) {
        expect(error).to.be.an('error');
        expect(error.message).to.equal('Unexpected API error');
      }
    });
  });

  describe('#phoneTemplates processChanges', () => {
    it('should create phone template', async () => {
      let createCalled = false;
      const auth0 = {
        branding: {
          phone: {
            templates: {
              list: () => Promise.resolve({ templates: [] }),
              create: (data) => {
                createCalled = true;
                expect(data.type).to.equal('otp_verify');
                expect(data.disabled).to.equal(false);
                return Promise.resolve({ id: 'pntm_new', ...data });
              },
            },
          },
        },
        pool: mockPool,
      };

      const handler = new phoneTemplatesHandler({ client: auth0, config: () => false });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      const newTemplate = {
        type: 'otp_verify',
        disabled: false,
        content: {
          syntax: 'liquid',
          from: '+15551234567',
          body: {
            text: 'Your code is {{ code }}',
          },
        },
      };

      await stageFn.apply(handler, [{ phoneTemplates: [newTemplate] }]);
      expect(createCalled).to.equal(true);
    });

    it('should update phone template', async () => {
      let updateCalled = false;
      const existingTemplate = {
        id: 'pntm_1234567890',
        type: 'otp_verify',
        disabled: false,
        content: {
          syntax: 'liquid',
          from: '+15551234567',
          body: {
            text: 'Old text',
          },
        },
      };

      const auth0 = {
        branding: {
          phone: {
            templates: {
              list: () => Promise.resolve({ templates: [existingTemplate] }),
              update: (id, updatePayload) => {
                updateCalled = true;
                expect(id).to.equal('pntm_1234567890');
                expect(updatePayload.content.body.text).to.equal('New text');
                expect(updatePayload.disabled).to.equal(true);
                return Promise.resolve({ id, ...updatePayload });
              },
            },
          },
        },
        pool: mockPool,
      };

      const handler = new phoneTemplatesHandler({ client: auth0, config: () => false });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      const updatedTemplate = {
        type: 'otp_verify',
        disabled: true,
        content: {
          syntax: 'liquid',
          from: '+15551234567',
          body: {
            text: 'New text',
          },
        },
      };

      await stageFn.apply(handler, [{ phoneTemplates: [updatedTemplate] }]);
      expect(updateCalled).to.equal(true);
    });

    it('should delete phone template when AUTH0_ALLOW_DELETE is true', async () => {
      let deleteCalled = false;
      const AUTH0_ALLOW_DELETE = true;

      const existingTemplate = {
        id: 'pntm_1234567890',
        type: 'otp_verify',
        disabled: false,
        content: {
          syntax: 'liquid',
          from: '+15551234567',
          body: {
            text: 'Some text',
          },
        },
      };

      const auth0 = {
        branding: {
          phone: {
            templates: {
              list: () => Promise.resolve({ templates: [existingTemplate] }),
              delete: (id) => {
                deleteCalled = true;
                expect(id).to.equal('pntm_1234567890');
                return Promise.resolve();
              },
            },
          },
        },
        pool: mockPool,
      };

      const handler = new phoneTemplatesHandler({
        client: auth0,
        config: () => AUTH0_ALLOW_DELETE,
      });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ phoneTemplates: [] }]);
      expect(deleteCalled).to.equal(true);
    });

    it('should not delete phone template when AUTH0_ALLOW_DELETE is false', async () => {
      const AUTH0_ALLOW_DELETE = false;

      const existingTemplate = {
        id: 'pntm_1234567890',
        type: 'otp_verify',
        disabled: false,
        content: {
          syntax: 'liquid',
          from: '+15551234567',
          body: {
            text: 'Some text',
          },
        },
      };

      const auth0 = {
        branding: {
          phone: {
            templates: {
              list: () => Promise.resolve({ templates: [existingTemplate] }),
              delete: () => {
                throw new Error('was not expecting delete to be called');
              },
            },
          },
        },
        pool: mockPool,
      };

      const handler = new phoneTemplatesHandler({
        client: auth0,
        config: () => AUTH0_ALLOW_DELETE,
      });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ phoneTemplates: [] }]);
    });

    it('should do nothing when phoneTemplates is not provided', async () => {
      const auth0 = {
        branding: {
          phone: {
            templates: {
              list: () => {
                throw new Error('was not expecting list to be called');
              },
            },
          },
        },
      };

      const handler = new phoneTemplatesHandler({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{}]);
    });
  });
});
