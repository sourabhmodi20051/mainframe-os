/**
 * @flow
 * @relayHash ebb95f28b3198c68da3d6251b93c5cc2
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest } from 'relay-runtime';
export type ConnectionState = "CONNECTED" | "SENDING" | "SENT" | "%future added value";
export type LauncherContactChangedSubscriptionVariables = {||};
export type LauncherContactChangedSubscriptionResponse = {|
  +contactChanged: {|
    +contact: {|
      +connectionState: ConnectionState,
      +profile: {|
        +name: ?string,
        +avatar: ?string,
      |},
    |}
  |}
|};
export type LauncherContactChangedSubscription = {|
  variables: LauncherContactChangedSubscriptionVariables,
  response: LauncherContactChangedSubscriptionResponse,
|};
*/


/*
subscription LauncherContactChangedSubscription {
  contactChanged {
    contact {
      connectionState
      profile {
        name
        avatar
      }
      id
    }
  }
}
*/

const node/*: ConcreteRequest*/ = (function(){
var v0 = {
  "kind": "ScalarField",
  "alias": null,
  "name": "connectionState",
  "args": null,
  "storageKey": null
},
v1 = {
  "kind": "LinkedField",
  "alias": null,
  "name": "profile",
  "storageKey": null,
  "args": null,
  "concreteType": "GenericProfile",
  "plural": false,
  "selections": [
    {
      "kind": "ScalarField",
      "alias": null,
      "name": "name",
      "args": null,
      "storageKey": null
    },
    {
      "kind": "ScalarField",
      "alias": null,
      "name": "avatar",
      "args": null,
      "storageKey": null
    }
  ]
};
return {
  "kind": "Request",
  "operationKind": "subscription",
  "name": "LauncherContactChangedSubscription",
  "id": null,
  "text": "subscription LauncherContactChangedSubscription {\n  contactChanged {\n    contact {\n      connectionState\n      profile {\n        name\n        avatar\n      }\n      id\n    }\n  }\n}\n",
  "metadata": {},
  "fragment": {
    "kind": "Fragment",
    "name": "LauncherContactChangedSubscription",
    "type": "Subscription",
    "metadata": null,
    "argumentDefinitions": [],
    "selections": [
      {
        "kind": "LinkedField",
        "alias": null,
        "name": "contactChanged",
        "storageKey": null,
        "args": null,
        "concreteType": "ContactChangedPayload",
        "plural": false,
        "selections": [
          {
            "kind": "LinkedField",
            "alias": null,
            "name": "contact",
            "storageKey": null,
            "args": null,
            "concreteType": "Contact",
            "plural": false,
            "selections": [
              v0,
              v1
            ]
          }
        ]
      }
    ]
  },
  "operation": {
    "kind": "Operation",
    "name": "LauncherContactChangedSubscription",
    "argumentDefinitions": [],
    "selections": [
      {
        "kind": "LinkedField",
        "alias": null,
        "name": "contactChanged",
        "storageKey": null,
        "args": null,
        "concreteType": "ContactChangedPayload",
        "plural": false,
        "selections": [
          {
            "kind": "LinkedField",
            "alias": null,
            "name": "contact",
            "storageKey": null,
            "args": null,
            "concreteType": "Contact",
            "plural": false,
            "selections": [
              v0,
              v1,
              {
                "kind": "ScalarField",
                "alias": null,
                "name": "id",
                "args": null,
                "storageKey": null
              }
            ]
          }
        ]
      }
    ]
  }
};
})();
// prettier-ignore
(node/*: any*/).hash = '94bcb435fc6b5f4f397cfcabafe92438';
module.exports = node;
