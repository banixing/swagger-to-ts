import {
  Operation,
  Path,
  Schema,
  Spec,
  Response,
  Reference,
  BodyParameter,
} from "swagger-schema-official";
import _ from "lodash";
import ts, { textSpanIntersectsWith } from "typescript";
import path from "path";
import { analysisDefinitionName } from "./utils/analysisDefinitionName";
import fs from "fs";
import {
  createJsDocDescription,
  createProperties,
  formatSchemaRef,
} from "./utils/jsDoc";

type Method = "get" | "put" | "post" | "delete" | "options" | "head" | "patch";

type Filter = (url: string, path: Operation) => boolean;

export class Generator {
  sources: { [fileName: string]: ts.SourceFile } = {};
  spec: Spec;
  paths?: string[];

  definitionNames: Set<string>;
  definitions: { [definitionsName: string]: Schema };

  filter: Filter = () => true;

  constructor(spec: Spec, paths?: string[] | string) {
    this.spec = spec;
    if (paths?.length) {
      this.paths = [...paths];
    }
    this.definitionNames = new Set();
    this.definitions = {};
  }

  generate() {
    const specPaths = Object.entries(this.spec.paths);
    let filterPaths = specPaths;
    if (this.paths) {
      filterPaths = specPaths.filter(([url]) => {
        return (this.paths as string[]).includes(url);
      });
    }
    filterPaths.forEach(([url, swaggerPath]) => {
      this.generatePathAst(url, swaggerPath);
    });
    // 简化分拆定义名
    const newDefinitionNames = this.analysisDefinitions(this.definitionNames);
    this.definitionNames.clear();
    this.definitionNames = newDefinitionNames;
    // 通过定义名找到定义
    if (this.spec.definitions) {
      this.filterDefinitions(this.definitionNames, this.spec.definitions);
    }
  }

  /**
   * 生成path语法树
   * @param swaggerApiUrl
   * @param swaggerPath
   */
  generatePathAst(swaggerApiUrl: string, swaggerPath: Path) {
    Object.keys(swaggerPath).forEach((method) => {
      if (["$ref", "parameters"].includes(method)) {
        return;
      }

      const operation = swaggerPath[method as Method] as Operation;
      this.generateApiAst(swaggerApiUrl, method, operation);
    });
  }

  /**
   * 收集path使用到的定义
   * @param swaggerUrl
   * @param method
   * @param operation
   */
  generateApiAst(swaggerUrl: string, method: string, operation: Operation) {
    // console.log("swaggerUrl", swaggerUrl, "method", method);
    const { summary, operationId, parameters, responses } = operation;
    if (!operationId) {
      // TODO 需要收集错误接口信息生成错误文档
      return;
    }

    // TODO 处理入参
    if (parameters && parameters.length) {
      const group = _.groupBy(parameters, "in");
      if (group.path) {
        // TODO 处理参数在path上的情况
        // console.log("group.path", group.path);
      }
      if (group.query) {
        // TODO 处理参数在query上的情况
        // console.log("group.query", group.query);
      }
      if (group.body) {
        // TODO 处理参数在body上的情况
        // console.log("group.body", group.body);
        group.body.forEach((parameter) => {
          let bodyParameter = parameter as BodyParameter;
          if (bodyParameter.schema) {
            const schemaRef = bodyParameter.schema["$ref"];

            const definition =
              schemaRef?.split("/")[schemaRef?.split("/").length - 1];
            // console.log("definition", definition);
            this.definitionNames.add(definition || "");
          }
        });
      }
    }

    // TODO 处理返回的参数
    const successResponse = responses["200"];
    if (successResponse) {
      let resSchema = (successResponse as Response).schema;
      if (!resSchema) {
        resSchema = {
          $ref: (successResponse as Reference).$ref,
        };
      }
      const schemaRef = resSchema["$ref"];
      const definition = formatSchemaRef(schemaRef);
      this.definitionNames.add(definition || "");
    }
  }

  // TODO 接口定义分析把嵌套的类型分拆
  analysisDefinitions(definitionNames: Set<string>) {
    const defNames: string[] = [];
    definitionNames.forEach((definitionName) => {
      if (definitionName) {
        const newDefinitionName = analysisDefinitionName(definitionName);
        defNames.push(...newDefinitionName);
      }
    });
    const newDefinitionNames = new Set(defNames);
    return newDefinitionNames;
  }

  // TODO 找到定义
  filterDefinitions(
    definitionNames: Set<string>,
    specDefinitions: {
      [definitionsName: string]: Schema;
    }
  ) {
    Object.entries(specDefinitions).forEach(([definitionsName, schema]) => {
      if (definitionNames.has(definitionsName)) {
        if (!this.definitions[definitionsName]) {
          this.definitions[definitionsName] = schema;
          // 找到schema的依赖
          if (schema.properties) {
            Object.entries(schema.properties).forEach(([propertyName, propertySchema])=> {
              let refName = ''
              if (Array.isArray(propertySchema.items)) {
                // TODO 待处理
              } else if (propertySchema.items && propertySchema.items['$ref']) {
                refName = propertySchema.items['$ref']
              }
              if (propertySchema['$ref']) {
                refName = propertySchema['$ref']
              }
              if (refName && this.spec.definitions) {
                const newRefName = formatSchemaRef(refName) || ''
                const definitionNames = analysisDefinitionName(newRefName)
                definitionNames.forEach(definitionsName => {
                  this.definitionNames.add(definitionsName)
                })
                
                this.filterDefinitions(new Set(definitionNames), this.spec.definitions)
              }
            })
          }
        }
      }
    });
  }
  

  // TODO 生成定义
  generateDefinitions(definitions: {
    [definitionsName: string]: Schema;
  }) {
   
    !fs.existsSync("./lib") && fs.mkdirSync("./lib");
    Object.entries(definitions).forEach(([name, schema]) => {
      // console.log(name, schema)
      let interfaceDocStr = "";
      interfaceDocStr += createJsDocDescription(schema);

      interfaceDocStr += `
      export interface ${name} {
        `;

      if (schema.properties) {
        const {propertiesStr, typeGraphs} = createProperties(schema.properties, schema.required)
        interfaceDocStr += propertiesStr;
        typeGraphs.forEach(typeGraph => {
          interfaceDocStr = `import { ${typeGraph} } from './${typeGraph}';\n` + interfaceDocStr
        })
        
      }
      interfaceDocStr += "}\n";

      fs.writeFileSync(`./lib/${name}.ts`, interfaceDocStr);
    });

    // console.log('definitions', definitions)
  }
}
