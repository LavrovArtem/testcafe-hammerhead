// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { createProcessScriptMethCall } from '../node-builder';
import { Syntax } from '../tools/esotope';
import { regExpProto } from '../../../protos';

const INVOCATION_FUNC_NAME_RE = /^(call|apply)$/;

// Transform:
// eval.call(ctx, script);
// eval.apply(ctx, script); -->
// eval.call(ctx, __proc$Script(script));
// eval.apply(ctx, __proc$Script(script, true));

export default {
    nodeReplacementRequireTransform: false,

    nodeTypes: [Syntax.CallExpression],

    condition: node => {
        // eval.<meth>(ctx, script, ...)
        if (node.arguments.length < 2)
            return false;

        if (node.callee.type === Syntax.MemberExpression && regExpProto.test(INVOCATION_FUNC_NAME_RE, node.callee.property.name)) {
            var obj = node.callee.object;

            // obj.eval.<meth>(), obj[eval].<meth>(),
            if (obj.type === Syntax.MemberExpression && (obj.property.value || obj.property.name) === 'eval')
                return true;

            // eval.<meth>()
            if (obj.name === 'eval')
                return true;
        }

        return false;
    },

    run: node => {
        var isApply = node.callee.property.name === 'apply';

        node.arguments[1] = createProcessScriptMethCall(node.arguments[1], isApply);

        return null;
    }
};
