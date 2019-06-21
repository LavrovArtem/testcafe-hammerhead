// var settings = hammerhead.get('./settings');

// var Promise       = hammerhead.Promise;
// var browserUtils  = hammerhead.utils.browser;
var transport     = hammerhead.transport;
// var nativeMethods = hammerhead.nativeMethods;

// var nativeLocalStorage = nativeMethods.winLocalStorageGetter.call(window);

// settings.get().serviceMsgUrl = '/service-msg';

// function sendAsyncServiceMsgWithDisableResendingFlag () {
//     return new Promise(function (resolve, reject) {
//         transport.asyncServiceMsg({ disableResending: true })
//             .then(function () {
//                 reject('message should not be sent');
//             });
//
//         window.setTimeout(resolve, 100);
//     });
// }

test('sendAsyncServiceMsg', function () {
    return transport.asyncServiceMsg({ delay: 100 })
        .then(function (result) {
            strictEqual(result.delay, 100);
        });
});

test('queuedAsyncServiceMsg', function () {
    var sendQueuedMsg = function (msg) {
        return transport.queuedAsyncServiceMsg(msg)
            .then(function (result) {
                result.timestamp = Date.now();
                return result;
            });
    };

    var msgPromises = [
        sendQueuedMsg({ cmd: 'Type1', delay: 500 }),
        sendQueuedMsg({ cmd: 'Type2', delay: 10 }),
        sendQueuedMsg({ cmd: 'Type1', delay: 200 }),
        sendQueuedMsg({ cmd: 'Type1', delay: 300 }),
        sendQueuedMsg({ cmd: 'Type1', delay: 200 })
    ];

    return Promise.all(msgPromises)
        .then(function (results) {
            results = results
                .sort(function (result1, result2) {
                    return result1.timestamp - result2.timestamp;
                })
                .map(function (result) {
                    return result.delay;
                });

            deepEqual(results, [10, 500, 200, 300, 200]);
        });
});

// test('batchUpdate - without stored messages', function () {
//     return transport.batchUpdate()
//         .then(function () {
//             ok(true);
//         });
// });
//
// test('batchUpdate - with stored messages', function () {
//     var savedQueuedAsyncServiceMsg = transport.queuedAsyncServiceMsg;
//     var result                     = 0;
//
//     transport.queuedAsyncServiceMsg = function (item) {
//         return new Promise(function (resolve) {
//             result += item.duration;
//             resolve();
//         });
//     };
//
//     var messages = [
//         { cmd: 'Type1', duration: 10 },
//         { cmd: 'Type2', duration: 20 },
//         { cmd: 'Type3', duration: 30 }
//     ];
//
//     nativeLocalStorage.setItem(settings.get().sessionId, JSON.stringify(messages));
//
//     return transport.batchUpdate()
//         .then(function () {
//             strictEqual(result, 60);
//
//             transport.queuedAsyncServiceMsg = savedQueuedAsyncServiceMsg;
//         });
// });
//
// if (!browserUtils.isWebKit && !browserUtils.isFirefox) {
//     test('resend aborted async service msg', function () {
//         var xhrCount = 0;
//
//         expect(2);
//
//         registerAfterAjaxSendHook(function (xhr) {
//             xhrCount++;
//
//             var expectedAsync = xhrCount === 1;
//
//             strictEqual(requestIsAsync, expectedAsync);
//
//             if (xhrCount === 1)
//                 xhr.abort();
//         });
//
//         return transport.asyncServiceMsg({})
//             .then(unregisterAfterAjaxSendHook);
//     });
// }
// else {
//     test('resend aborted async service msg (WebKit)', function () {
//         settings.get().sessionId = '%%%testUid%%%';
//
//         var xhrCount = 0;
//         var value    = 'testValue';
//
//         ok(!nativeLocalStorage.getItem(settings.get().sessionId));
//
//         registerAfterAjaxSendHook(function (xhr) {
//             xhrCount++;
//             xhr.abort();
//         });
//
//         return transport.asyncServiceMsg({ test: value })
//             .then(function () {
//                 strictEqual(xhrCount, 1);
//
//                 var storedMsgStr = nativeLocalStorage.getItem(settings.get().sessionId);
//                 var storedMsg    = JSON.parse(storedMsgStr)[0];
//
//                 ok(storedMsgStr);
//                 strictEqual(storedMsg.test, value);
//
//                 unregisterAfterAjaxSendHook();
//
//                 nativeLocalStorage.removeItem(settings.get().sessionId);
//             });
//     });
//
//     test('do not duplicate messages in store (WebKit)', function () {
//         settings.get().sessionId = '%%%testUid%%%';
//
//         ok(!nativeLocalStorage.getItem(settings.get().sessionId));
//
//         registerAfterAjaxSendHook(function (xhr) {
//             xhr.abort();
//         });
//
//         var msg         = { test: 'testValue' };
//         var msgPromises = [
//             transport.asyncServiceMsg(msg),
//             transport.asyncServiceMsg(msg)
//         ];
//
//         return Promise.all(msgPromises)
//             .then(function () {
//                 var storedMsgStr = nativeLocalStorage.getItem(settings.get().sessionId);
//                 var storedMsgArr = JSON.parse(storedMsgStr);
//
//                 strictEqual(storedMsgArr.length, 1);
//
//                 unregisterAfterAjaxSendHook();
//
//                 nativeLocalStorage.removeItem(settings.get().sessionId);
//             });
//     });
// }
//
// if (browserUtils.isWebKit || browserUtils.isFirefox) {
//     test('do not resend aborted async service msg if it contains "disableResending" flag (WebKit)', function () {
//         settings.get().sessionId = '%%%testUid%%%';
//
//         var xhrCount = 0;
//
//         ok(!nativeLocalStorage.getItem(settings.get().sessionId));
//
//         registerAfterAjaxSendHook(function (xhr) {
//             xhrCount++;
//             xhr.abort();
//         });
//
//         return sendAsyncServiceMsgWithDisableResendingFlag()
//             .then(function () {
//                 strictEqual(xhrCount, 1);
//
//                 var storedMsgStr = nativeLocalStorage.getItem(settings.get().sessionId);
//
//                 strictEqual(storedMsgStr, '[]');
//
//                 nativeLocalStorage.removeItem(settings.get().sessionId);
//
//                 unregisterAfterAjaxSendHook();
//             });
//     });
// }
// else {
//     test('do not resend aborted async service msg if it contains "disableResending" flag', function () {
//         var xhrCount = 0;
//
//         registerAfterAjaxSendHook(function (xhr) {
//             xhrCount++;
//             xhr.abort();
//         });
//
//         return sendAsyncServiceMsgWithDisableResendingFlag()
//             .then(function () {
//                 strictEqual(xhrCount, 1);
//
//                 unregisterAfterAjaxSendHook();
//             });
//     });
// }
//
// test('asyncServiceMessage - should reject if enableRejecting is true', function () {
//     var xhrCount = 0;
//
//     registerAfterAjaxSendHook(function (xhr) {
//         xhrCount++;
//         xhr.abort();
//     });
//
//     return transport.asyncServiceMsg({ disableResending: true, allowRejecting: true })
//         .then(function () {
//             throw new Error('Promise rejection expected');
//         })
//         .catch(function (error) {
//             strictEqual(xhrCount, 1);
//             strictEqual(error.message, 'XHR request failed with 0 status code.');
//
//             unregisterAfterAjaxSendHook();
//         });
// });
//
// test('queuedAsyncServiceMessage - should work with failed and rejected attempts', function () {
//     let xhrCount          = 0;
//     let firstMsgResolved  = false;
//     let firstMsgRejected  = false;
//     let secondMsgRejected = false;
//     let thirdMsgResolved  = false;
//
//     registerAfterAjaxSendHook(function (xhr) {
//         xhrCount++;
//
//         if (xhrCount < 3)
//             xhr.abort();
//     });
//
//     // NOTE: expected to fail, but not reject
//     transport
//         .queuedAsyncServiceMsg({ disableResending: true })
//         .then(function () {
//             firstMsgResolved = true;
//         })
//         .catch(function () {
//             firstMsgRejected = true;
//         });
//
//     // NOTE: expected to fail and reject
//     const secondMsgPromise = transport
//         .queuedAsyncServiceMsg({ disableResending: true, allowRejecting: true })
//         .catch(function () {
//             secondMsgRejected = true;
//         });
//
//     // NOTE: expected to pass
//     const thirdMsgPromise = transport
//         .queuedAsyncServiceMsg({ disableResending: true, allowRejecting: true })
//         .then(function () {
//             thirdMsgResolved = true;
//         });
//
//     return Promise
//         .all([secondMsgPromise, thirdMsgPromise])
//         .then(function () {
//             strictEqual(xhrCount, 3);
//             ok(!firstMsgResolved);
//             ok(!firstMsgRejected);
//             ok(secondMsgRejected);
//             ok(thirdMsgResolved);
//
//             unregisterAfterAjaxSendHook();
//         });
// });
//
// module('regression');
//
// test('hammerhead should remove service data from local storage on the first session page load (GH-100)', function () {
//     var sessionId = settings.get().sessionId;
//
//     // NOTE: First page loading.
//     settings.get().isFirstPageLoad = true;
//
//     // NOTE: Add service data.
//     nativeLocalStorage.setItem(sessionId, 'some-serive-data');
//
//     var hh = new hammerhead.constructor(window);
//
//     hh.start(settings.get(), window);
//
//     ok(!nativeLocalStorage.getItem(sessionId));
// });

test('failed service messages should respond via error handler (GH-1839)', function () {
    return transport.asyncServiceMsg({ disableResending: true, allowRejecting: true, respondWithError: true })
        .then(function () {
            ok(false, 'Promise rejection expected');
        })
        .catch(function (err) {
            strictEqual(err, 'Error message: An error occurred!!!');
        });
});
