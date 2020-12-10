async function dump(context) {
  return (context.assets.clients || []).map(client => ({
    type: 'auth0_client',
    name: client.name,
    content: {
      name: client.name,
      description: client.description,
      app_type: client.app_type,
      logo_uri: client.logo_uri,
      is_first_party: client.is_first_party,
      is_token_endpoint_ip_header_trusted: client.is_token_endpoint_ip_header_trusted,
      oidc_conformant: client.oidc_conformant,
      callbacks: client.callbacks,
      allowed_logout_urls: client.allowed_logout_urls,
      grant_types: client.grant_types,
      allowed_origins: client.allowed_origins,
      web_origins: client.web_origins,
      jwt_configuration: client.jwt_configuration,
      encryption_key: client.encryption_key,
      sso: client.sso,
      sso_disabled: client.sso_disabled,
      cross_origin_auth: client.cross_origin_auth,
      cross_origin_loc: client.cross_origin_loc,
      custom_login_page_on: client.custom_login_page_on,
      custom_login_page: client.custom_login_page,
      custom_login_page_preview: client.custom_login_page_preview,
      form_template: client.form_template,
      addons: client.addons,
      token_endpoint_auth_method: client.token_endpoint_auth_method,
      client_metadata: client.client_metadata,
      mobile: client.mobile,
      initiate_login_uri: client.initiate_login_uri
    }
  }));
}


export default {
  dump
};
