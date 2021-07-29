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
import ts from "typescript";
import path from "path";
import { analysisDefinitionName } from "./utils/analysisDefinitionName";
import fs from "fs";
import { createJsDocDescription, createProperties, formatSchemaRef } from "./utils/jsDoc";

type Method = "get" | "put" | "post" | "delete" | "options" | "head" | "patch";

type Filter = (url: string, path: Operation) => boolean;

export class Generator {
  sources: { [fileName: string]: ts.SourceFile } = {};
  spec: Spec;
  paths?: string[];

  definitions: Set<string>;

  filter: Filter = () => true;

  constructor(spec: Spec, paths?: string[] | string) {
    this.spec = spec;
    if (paths?.length) {
      this.paths = [...paths];
    }
    this.definitions = new Set();
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
   * 生成ApiAst
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
            this.definitions.add(definition || "");
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
      // console.log(resSchema);
      const schemaRef = resSchema["$ref"];

      const definition = formatSchemaRef(schemaRef);

      this.definitions.add(definition || "");
    }
  }

  // TODO 分析定义
  analysisDefinitions() {
    const aaa: string[] = [];
    this.definitions.forEach((definition) => {
      if ("definition") {
        const newDefinitionName = analysisDefinitionName(definition);
        console.log('newDefinitionName', newDefinitionName)
        aaa.push(...newDefinitionName);
      }
    });
    const newDefinitions = new Set(aaa);
    console.log('newDefinitions', newDefinitions)
    return newDefinitions;
  }
  // TODO 找到定义
  filterDefinitions() {
    const newDefinitions = this.analysisDefinitions();
    const definitions: Schema[] = [];

    const specDefinitions = this.spec.definitions;

    let newSpecDefinitions: [string, Schema][] = [];

    if (specDefinitions) {
      newSpecDefinitions = Object.entries(specDefinitions).filter(
        ([definitionsName, schema]) => {
          if (newDefinitions.has(definitionsName)) {
            return true;
          } else {
            return false;
          }
        }
      );
    }
    return newSpecDefinitions;
  }
  // TODO 生成定义
  generateDefinitions() {
    const definitions = this.filterDefinitions();
    !fs.existsSync("./lib") && fs.mkdirSync("./lib");

    definitions.forEach(([name, schema]) => {
      // console.log(name, schema)
      let interfaceDocStr = "";
      interfaceDocStr += createJsDocDescription(schema);

      interfaceDocStr += `
      export interface ${name} {
        `;

      if (schema.properties) {
        interfaceDocStr += createProperties(schema.properties, schema.required);
      }
      interfaceDocStr += "}\n";

      fs.writeFileSync(`./lib/${name}.ts`, interfaceDocStr);
    });

    // console.log('definitions', definitions)
  }
}
