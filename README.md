#Auth0 Deploy CLI

There are a few good extensions that you can use to deploy updates automatically.  This tool utilizes that same code base to allow anyone to pass json to this tool and deploy to your tenant.  This allows you to call this from any tool that can call node.  The intention is to allow deploy from any source code repository and incorporate in any build script.


## Install

### General Install

```
npm i -g auth0-deploy-cli
```

### To test locally

Clone the github repo and install globally
```
git clone git@github.com:auth0/auth0-deploy-cli
cd auth0-deploy-cli
npm install -g
```

## Usage

```
You must create a client in your service account that has access to the management API with the following scopes:
  * read:tenant_settings
  * update:tenant_settings
  * read:clients
  * update:clients
  * delete:clients
  * read:connections
  * update:connections
  * read:rules
  * create:rules
  * update:rules
  * delete:rules

a0deploy [ options ]
    -i,--input_file     The updates to deploy.  See JSON Format for more information.
    -c,--config_file    The JSON configuration file.  See JSON Format for more information.
    
    Config JSON Format
    {
      Leave this? "SLACK_INCOMING_WEBHOOK_URL": "https://hooks.slack.com/services/...",
      "AUTH0_DOMAIN": "YOUR_DOMAIN",
      "AUTH0_CLIENT_SECRET": "YOUR_CLIENT_SECRET",
      "AUTH0_CLIENT_ID": "YOUR_CLIENT_ID"
    }
```

## JSON Formats

### Input File

### Config File

##Known issues
See https://github.com/auth0/auth0-deploy-cli/issues

##License
MIT