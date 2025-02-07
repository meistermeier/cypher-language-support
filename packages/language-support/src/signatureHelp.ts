import {
  SignatureHelp,
  SignatureInformation,
} from 'vscode-languageserver-types';

import { ParserRuleContext } from 'antlr4';
import {
  CallClauseContext,
  FunctionInvocationContext,
} from './generated-parser/CypherParser';

import { DbSchema } from './dbSchema';
import { findParent } from './helpers';
import { parserWrapper } from './parserWrapper';

export const emptyResult: SignatureHelp = {
  signatures: [],
  activeSignature: undefined,
  activeParameter: undefined,
};

interface ParsedMethod {
  methodName: string;
  numProcedureArgs: number;
}

function tryParseProcedure(
  currentNode: ParserRuleContext,
): ParsedMethod | undefined {
  const callClause = findParent(
    currentNode,
    (node) => node instanceof CallClauseContext,
  );

  if (callClause) {
    const ctx = callClause as CallClauseContext;

    const methodName = ctx.procedureName().getText();
    const numProcedureArgs = ctx.procedureArgument_list().length;
    return {
      methodName: methodName,
      numProcedureArgs: numProcedureArgs,
    };
  } else {
    return undefined;
  }
}

function tryParseFunction(
  currentNode: ParserRuleContext,
): ParsedMethod | undefined {
  const functionInvocation = findParent(
    currentNode,
    (node) => node instanceof FunctionInvocationContext,
  );

  if (functionInvocation) {
    const ctx = functionInvocation as FunctionInvocationContext;
    const methodName = ctx.functionName().getText();
    const numMethodArgs = ctx.functionArgument_list().length;

    return {
      methodName: methodName,
      numProcedureArgs: numMethodArgs,
    };
  } else {
    return undefined;
  }
}

function toSignatureHelp(
  methodSignatures: Record<string, SignatureInformation>,
  parsedMethod: ParsedMethod,
) {
  const methodName = parsedMethod.methodName;
  const numMethodArgs = parsedMethod.numProcedureArgs;
  const method = methodSignatures[methodName];
  const signatures = method ? [method] : [];
  const argPosition =
    numMethodArgs !== undefined ? Math.max(numMethodArgs - 1, 0) : undefined;

  const signatureHelp: SignatureHelp = {
    signatures: signatures,
    activeSignature: method ? 0 : undefined,
    activeParameter: argPosition,
  };
  return signatureHelp;
}

export function signatureHelp(
  textUntilPosition: string,
  dbSchema: DbSchema,
): SignatureHelp {
  const parserResult = parserWrapper.parse(textUntilPosition);
  const stopNode = parserResult.stopNode;
  let result: SignatureHelp = emptyResult;

  const parsedProc = tryParseProcedure(stopNode);
  if (parsedProc && dbSchema.procedureSignatures) {
    result = toSignatureHelp(dbSchema.procedureSignatures, parsedProc);
  } else {
    const parsedFunc = tryParseFunction(stopNode);

    if (parsedFunc && dbSchema.functionSignatures) {
      result = toSignatureHelp(dbSchema.functionSignatures, parsedFunc);
    }
  }

  return result;
}
