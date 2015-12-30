// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
/* eslint hammerhead/proto-methods: 2 */

// NOTE: Some websites override the String.prototype.trim method. When we use this function
// in our scripts, we expect it to have the default behavior. Therefore, in order to protect
// ourselves from spoofing, we must use our own implementation.
import { stringProto } from '../protos';

export default function trim (str) {
    return stringProto.replace(str, /^\s+|\s+$/g, '');
}
