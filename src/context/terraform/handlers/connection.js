async function parse(context) {
  throw new Error('Not Implemented' + context);
}

async function dump(context) {
  return (context.assets.connections || []).map(connection => ({
    type: 'auth0_connection',
    name: connection.name,
    content: {
      name: connection.name,
      display_name: connection.display_name,
      is_domain_connection: connection.is_domain_connection,
      strategy: connection.strategy,
      options: connection.options ? {
        validation: connection.options.validation,
        password_policy: connection.options.password_policy,
        password_history: connection.options.password_history,
        password_no_personal_info: connection.options.password_no_personal_info,
        password_dictionary: connection.options.password_dictionary,
        password_complexity_options: connection.options.password_complexity_options,
        enabled_database_customization: connection.options.enabled_database_customization,
        brute_force_protection: connection.options.brute_force_protection,
        import_mode: connection.options.import_mode,
        disable_signup: connection.options.disable_signup,
        requires_username: connection.options.requires_username,
        custom_scripts: connection.options.custom_scripts,
        configuration: connection.options.configuration,
        client_id: connection.options.client_id,
        allowed_audiences: connection.options.allowed_audiences,
        api_enable_users: connection.options.api_enable_users,
        app_id: connection.options.app_id,
        app_domain: connection.options.app_domain,
        domain: connection.options.domain,
        domain_aliases: connection.options.domain_aliases,
        max_groups_to_retrieve: connection.options.max_groups_to_retrieve,
        tenant_domain: connection.options.tenant_domain,
        use_wsfed: connection.options.use_wsfed,
        waad_protocol: connection.options.waad_protocol,
        waad_common_endpoint: connection.options.waad_common_endpoint,
        icon_url: connection.options.icon_url,
        identity_api: connection.options.identity_api,
        ips: connection.options.ips,
        use_cert_auth: connection.options.use_cert_auth,
        use_kerberos: connection.options.use_kerberos,
        disable_cache: connection.options.disable_cache,
        name: connection.options.name,
        twilio_sid: connection.options.twilio_sid,
        from: connection.options.from,
        syntax: connection.options.syntax,
        subject: connection.options.subject,
        template: connection.options.template,
        totp: connection.options.totp,
        messaging_service_sid: connection.options.messaging_service_sid,
        team_id: connection.options.team_id,
        key_id: connection.options.key_id,
        adfs_server: connection.options.adfs_server,
        community_base_url: connection.options.community_base_url,
        strategy_version: connection.options.strategy_version,
        scopes: connection.options.scope,
        type: connection.options.type,
        issuer: connection.options.issuer,
        jwks_uri: connection.options.jwks_uri,
        discovery_url: connection.options.discovery_url,
        token_endpoint: connection.options.token_endpoint,
        userinfo_endpoint: connection.options.userinfo_endpoint,
        authorization_endpoint: connection.options.authorization_endpoint,
        debug: connection.options.debug,
        signing_cert: connection.options.signing_cert,
        protocol_binding: connection.options.protocol_binding,
        idp_initiated: connection.options.idp_initiated,
        sign_in_endpoint: connection.options.sign_in_endpoint,
        sign_out_endpoint: connection.options.sign_out_endpoint,
        fields_map: connection.options.fields_map,
        sign_saml_request: connection.options.sign_saml_request,
        signature_algorithm: connection.options.signature_algorithm,
        digest_algorithm: connection.options.digest_algorithm
      } : undefined,
      enabled_clients: connection.enabled_clients,
      realms: connection.realms
    }
  }));
}


export default {
  parse,
  dump
};
