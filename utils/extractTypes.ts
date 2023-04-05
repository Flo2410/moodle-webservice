import IMoodleWSDefinition from '../interfaces/IMoodleWSDefinition';
import * as fs from 'fs';
import * as prettier from 'prettier';
import path from 'path';
import { IMoodleWSFnSignature } from '../interfaces/IMoodleWSFnSignature';

const PRETTIER_CONFIG: prettier.Options = {
  singleQuote: true,
  tabWidth: 2,
  useTabs: false,
  parser: 'typescript',
};
const format = (data: string) => prettier.format(data, PRETTIER_CONFIG);

interface IMoodleFunction {
  name: string;
  apiName: string;
}

interface IMoodleFacility {
  name: string;
  functions: IMoodleFunction[];
}

interface IMoodleModule {
  name: string;
  facilities: IMoodleFacility[];
}
const definitionJSON = fs.readFileSync(
  path.resolve(__dirname, '../api', 'functions.json'),
  'utf8'
);
const signatureJSON = fs.readFileSync(
  path.resolve(__dirname, '../api', 'function-signatures.json'),
  'utf8'
);
const definition: IMoodleWSDefinition = JSON.parse(definitionJSON);
const signatures: IMoodleWSFnSignature[] = JSON.parse(signatureJSON).items;

const extractModules = (): IMoodleModule[] => {
  const modules: IMoodleModule[] = [];

  for (const item of definition.items) {
    const module = modules.find((module) => module.name === item.module);
    if (!module) {
      const newModule: IMoodleModule = {
        name: item.module,
        facilities: [
          {
            name: item.facility,
            functions: [{ name: item.preferName, apiName: item.name }],
          },
        ],
      };

      modules.push(newModule);
      continue;
    } else {
      const facility = module.facilities.find(
        (facility) => facility.name === item.facility
      );
      if (!facility) {
        const newFacility: IMoodleFacility = {
          name: item.facility,
          functions: [{ name: item.preferName, apiName: item.name }],
        };

        module.facilities.push(newFacility);
        continue;
      } else {
        const func = facility.functions.find(
          (func) => func.name === item.preferName
        );

        if (!func) {
          facility.functions.push({
            name: item.preferName,
            apiName: item.name,
          });
        }
      }
    }
  }
  return modules;
};

const upperCaseFirst = (str: string) =>
  `${str.at(0)?.toUpperCase()}${str.slice(1)}`;

const getInterfaceName = (module: IMoodleModule) =>
  `IMoodleWS${upperCaseFirst(module.name)}`;

const parseTypeName = (typeName: string) => {
  const rawName = /([\s\S]*)\[\]/.exec(typeName)![1];
  let type: 'type' | 'interface' | undefined;
  if (typeName.at(0) === 'I') type = 'interface';
  return { rawName, type };
};

const writeFunctionSignature = (
  func: IMoodleFunction,
  signature?: IMoodleWSFnSignature
) => {
  if (signature) {
    return `${func.name}: (${
      signature.bodyType ? `params: ${signature.bodyType}` : ''
    }) => Promise<${signature.resultType ? signature.resultType : 'void'}>;`;
  } else {
    return `${func.name}: (payload: IMoodleWSPayload) => Promise<any>;`;
  }
};

const writeFacilityFunctions = (facility: IMoodleFacility) => {
  let functions = ``;
  for (const func of facility.functions) {
    const signature = signatures.find((sig) => sig.name === func.apiName);
    functions = functions
      .concat(writeFunctionSignature(func, signature))
      .concat('\n');
  }
  return functions;
};

const writeFacilityObject = (facility: IMoodleFacility) => {
  return `${facility.name}: {
    ${writeFacilityFunctions(facility)}
    };`;
};

const writeModuleFacilties = (module: IMoodleModule) => {
  let facilities = ``;
  for (const facility of module.facilities) {
    facilities = facilities.concat(writeFacilityObject(facility)).concat('\n');
  }
  return facilities;
};

const writeModuleImports = (module: IMoodleModule) => {
  const imports: string[] = ['IMoodleWSPayload'];
  for (const facility of module.facilities) {
    for (const func of facility.functions) {
      const signature = signatures.find((sig) => sig.name === func.apiName);
      if (signature) {
        if (signature.bodyType) {
          const type = parseTypeName(signature.bodyType);
          if (!imports.includes(type.rawName)) imports.push(type.rawName);
        }
        if (signature.resultType) {
          const type = parseTypeName(signature.resultType);
          if (!imports.includes(type.rawName)) imports.push(type.rawName);
        }
      }
    }
  }
  return imports.map((imp) => `import ${imp} from './${imp}'`).join('\n');
};

const writeModuleInterface = (module: IMoodleModule) => {
  return `export default interface ${getInterfaceName(module)} {
    ${writeModuleFacilties(module)}
  }`;
};

const createModuleFile = (module: IMoodleModule) => {
  const moduleFileData = format(
    `${writeModuleImports(module)}\n\n${writeModuleInterface(module)}`
  );
  const interfaceName = getInterfaceName(module);
  fs.writeFileSync(
    path.resolve(__dirname, '../interfaces', `${interfaceName}.ts`),
    moduleFileData
  );
};

const createModuleFiles = (modules: IMoodleModule[]) => {
  for (const module of modules) {
    createModuleFile(module);
  }
};

const writeImportModule = (module: IMoodleModule) => {
  const interfaceName = getInterfaceName(module);
  return `import ${interfaceName} from './${interfaceName}'`;
};

const writeImportApiModules = (modules: IMoodleModule[]) => {
  let imports = ``;
  for (const module of modules) {
    imports = imports.concat(writeImportModule(module)).concat('\n');
  }
  return imports;
};

const writeModuleObject = (module: IMoodleModule) =>
  `${module.name}: ${getInterfaceName(module)};`;

const writeApiModules = (modules: IMoodleModule[]) => {
  let apiModules = ``;
  for (const module of modules) {
    apiModules = apiModules.concat(writeModuleObject(module)).concat('\n');
  }
  return apiModules;
};

const writeApiInterface = (modules: IMoodleModule[]) => {
  return `export default interface IMoodleWSAPI {
        ${writeApiModules(modules)}
    }`;
};

const createApiFile = (modules: IMoodleModule[]) => {
  const apiFileData = `${writeImportApiModules(modules)}\n\n${writeApiInterface(
    modules
  )}`;
  fs.writeFileSync(
    path.resolve(__dirname, `../interfaces`, 'IMoodleWSAPI.ts'),
    format(apiFileData)
  );
};

const extractApiTypes = (modules: IMoodleModule[]) => {
  createModuleFiles(modules);
  createApiFile(modules);
};

extractApiTypes(extractModules());
