___TERMS_OF_SERVICE___

By creating or modifying this file you agree to Google Tag Manager's Community
Template Gallery Developer Terms of Service available at
https://developers.google.com/tag-manager/gallery-tos (or such other URL as
Google may provide), as modified from time to time.


___INFO___

{
  "type": "TAG",
  "id": "cvt_temp_public_id",
  "version": 1,
  "securityGroups": [],
  "displayName": "Support.io Live Chat",
  "categories": [
    "CHAT"
  ],
  "brand": {
    "id": "brand_dummy",
    "displayName": "Support.io"
  },
  "description": "Adds the Support.io live chat bubble to your site. Enter the site key from your Support.io dashboard and fire the tag on All Pages.",
  "containerContexts": [
    "WEB"
  ]
}


___TEMPLATE_PARAMETERS___

[
  {
    "type": "TEXT",
    "name": "siteKey",
    "displayName": "Site key",
    "simpleValueType": true,
    "help": "In your Support.io dashboard, open Sites: the site key is in your site's installation code, after data-site-key.",
    "valueValidators": [
      {
        "type": "NON_EMPTY"
      },
      {
        "type": "REGEX",
        "args": [
          "^[A-Za-z0-9-]{8,64}$"
        ]
      }
    ]
  }
]


___SANDBOXED_JS_FOR_WEB_TEMPLATE___

const copyFromWindow = require('copyFromWindow');
const injectScript = require('injectScript');
const setInWindow = require('setInWindow');

// The chat reads its site key from window.SupportChatConfig when its script
// tag carries none; settings the page already put there are kept.
const config = copyFromWindow('SupportChatConfig') || {};
config.siteKey = data.siteKey;
setInWindow('SupportChatConfig', config, true);

injectScript(
  'https://__APP_DOMAIN__/widget.js',
  data.gtmOnSuccess,
  data.gtmOnFailure,
  'support-io-widget'
);


___WEB_PERMISSIONS___

[
  {
    "instance": {
      "key": {
        "publicId": "access_globals",
        "versionId": "1"
      },
      "param": [
        {
          "key": "keys",
          "value": {
            "type": 2,
            "listItem": [
              {
                "type": 3,
                "mapKey": [
                  {
                    "type": 1,
                    "string": "key"
                  },
                  {
                    "type": 1,
                    "string": "read"
                  },
                  {
                    "type": 1,
                    "string": "write"
                  },
                  {
                    "type": 1,
                    "string": "execute"
                  }
                ],
                "mapValue": [
                  {
                    "type": 1,
                    "string": "SupportChatConfig"
                  },
                  {
                    "type": 8,
                    "boolean": true
                  },
                  {
                    "type": 8,
                    "boolean": true
                  },
                  {
                    "type": 8,
                    "boolean": false
                  }
                ]
              }
            ]
          }
        }
      ]
    },
    "clientAnnotations": {
      "isEditedByUser": true
    },
    "isRequired": true
  },
  {
    "instance": {
      "key": {
        "publicId": "inject_script",
        "versionId": "1"
      },
      "param": [
        {
          "key": "urls",
          "value": {
            "type": 2,
            "listItem": [
              {
                "type": 1,
                "string": "https://__APP_DOMAIN__/widget.js"
              }
            ]
          }
        }
      ]
    },
    "clientAnnotations": {
      "isEditedByUser": true
    },
    "isRequired": true
  }
]


___TESTS___

scenarios:
- name: Loads the chat with the site key
  code: |-
    const mockData = { siteKey: '3f1c2a9e-0b7d-4c55-9a40-1d2e3f4a5b6c' };
    mock('injectScript', (url, onSuccess) => {
      assertThat(url).isEqualTo('https://__APP_DOMAIN__/widget.js');
      onSuccess();
    });
    runCode(mockData);
    assertApi('setInWindow').wasCalledWith(
      'SupportChatConfig',
      { siteKey: '3f1c2a9e-0b7d-4c55-9a40-1d2e3f4a5b6c' },
      true
    );
    assertApi('gtmOnSuccess').wasCalled();
- name: Keeps what the page already configured
  code: |-
    mock('copyFromWindow', (key) => ({ locale: 'en' }));
    mock('injectScript', (url, onSuccess) => onSuccess());
    runCode({ siteKey: '3f1c2a9e-0b7d-4c55-9a40-1d2e3f4a5b6c' });
    assertApi('setInWindow').wasCalledWith(
      'SupportChatConfig',
      { locale: 'en', siteKey: '3f1c2a9e-0b7d-4c55-9a40-1d2e3f4a5b6c' },
      true
    );
- name: Reports a failed load
  code: |-
    mock('injectScript', (url, onSuccess, onFailure) => onFailure());
    runCode({ siteKey: '3f1c2a9e-0b7d-4c55-9a40-1d2e3f4a5b6c' });
    assertApi('gtmOnFailure').wasCalled();


___NOTES___

Support.io Live Chat. Built from integrations/gtm/template.tpl; the release
script replaces __APP_DOMAIN__ with the production domain.
