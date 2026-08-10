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
          text: 'Your verification code is ##OTP_VERIFICATION_TEXT## {{ code }}',
          voice: 'Your verification code is ##OTP_VERIFICATION_TEXT## {{ code }}',
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
          text: 'Your enrollment code is ##OTP_ENROLL_TEXT## {{ code }}',
          voice: 'Your enrollment code is ##OTP_ENROLL_TEXT## {{ code }}',
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
            text: 'Your verification code is ##OTP_VERIFICATION_TEXT## {{ code }}',
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
            text: 'Your verification code is ##OTP_VERIFICATION_TEXT## {{ code }}',
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
                expect(updatePayload.content.body.text).to.equal(
                  'Your verification code is ##OTP_VERIFICATION_TEXT## {{ code }}'
                );
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
            text: 'Your verification code is ##OTP_VERIFICATION_TEXT## {{ code }}',
          },
        },
      };

      await stageFn.apply(handler, [{ phoneTemplates: [updatedTemplate] }]);
      expect(updateCalled).to.equal(true);
    });

    it('should create phone template when existing template has no id (new tenant)', async () => {
      // On a newly created tenant the API returns default templates without an id
      // until they are explicitly created. The CLI must POST rather than PATCH.
      let createCalled = false;
      const existingTemplateWithoutId = {
        type: 'otp_verify',
        disabled: false,
        content: {
          syntax: 'liquid',
          from: '',
          body: {
            text: 'Default text',
            voice: 'Default voice',
          },
        },
      };

      const auth0 = {
        branding: {
          phone: {
            templates: {
              list: () => Promise.resolve({ templates: [existingTemplateWithoutId] }),
              create: (data) => {
                createCalled = true;
                expect(data.type).to.equal('otp_verify');
                expect(data.content.body.text).to.equal('Updated text');
                return Promise.resolve({ id: 'pntm_new', ...data });
              },
              update: () => {
                throw new Error('was not expecting update to be called');
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
        disabled: false,
        content: {
          syntax: 'liquid',
          from: '',
          body: {
            text: 'Updated text',
            voice: 'Default voice',
          },
        },
      };

      await stageFn.apply(handler, [{ phoneTemplates: [updatedTemplate] }]);
      expect(createCalled).to.equal(true);
    });

    it('should strip read-only fields from the create payload', async () => {
      let createPayload;
      const auth0 = {
        branding: {
          phone: {
            templates: {
              list: () => Promise.resolve({ templates: [] }),
              create: (data) => {
                createPayload = data;
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
        channel: 'sms',
        customizable: true,
        tenant: 'test-tenant',
        content: {
          syntax: 'liquid',
          from: '+15551234567',
          body: { text: 'Some text' },
        },
      };

      await stageFn.apply(handler, [{ phoneTemplates: [newTemplate] }]);
      expect(createPayload).to.not.have.property('channel');
      expect(createPayload).to.not.have.property('customizable');
      expect(createPayload).to.not.have.property('tenant');
      expect(createPayload.type).to.equal('otp_verify');
      expect(createPayload.content.body.text).to.equal('Some text');
    });

    it('should fall back to update when create returns 409 conflict', async () => {
      // If the template already exists (created between list and create, or its
      // ID wasn't surfaced by list), create returns 409 and we re-fetch + update.
      let updateCalled = false;
      let listCalls = 0;
      const auth0 = {
        branding: {
          phone: {
            templates: {
              list: () => {
                listCalls += 1;
                // First list (getType): no ID. Second list (after 409): has ID.
                const template = {
                  type: 'otp_verify',
                  disabled: false,
                  content: { syntax: 'liquid', from: '', body: { text: 'x', voice: 'y' } },
                };
                if (listCalls > 1) {
                  return Promise.resolve({ templates: [{ id: 'pntm_existing', ...template }] });
                }
                return Promise.resolve({ templates: [template] });
              },
              create: () => {
                const err = new Error('Conflict');
                (err as any).statusCode = 409;
                return Promise.reject(err);
              },
              update: (id, updatePayload) => {
                updateCalled = true;
                expect(id).to.equal('pntm_existing');
                expect(updatePayload.content.body.text).to.equal('Updated text');
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
        disabled: false,
        content: { syntax: 'liquid', from: '', body: { text: 'Updated text', voice: 'y' } },
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
