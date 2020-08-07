async function dump(context) {
  return (context.assets.emailTemplates || []).map((emailTemplate, i) => ({
    type: 'auth0_email_template',
    name: `email_template_${i}`,
    content: emailTemplate
  }));
}

export default {
  dump
};
