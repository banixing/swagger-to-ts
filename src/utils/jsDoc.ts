import { Schema } from "swagger-schema-official";
import ts from 'typescript';

/**
 * 生成Properties注释
 * @param description
 * @returns
 */
export function createPropertyDescription(description?: string) {
  let result = "";
  if (description) {
    result = `/** 
          * ${description}
          */`;
  }
  return result;
}
/**
 * 生成文档注释
 * @param schema
 * @returns
 */
export function createJsDocDescription(schema: Schema) {
  const description = schema.description || schema.title || "";
  const result = createPropertyDescription(description);
  return result;
}

/**
 * 创建属性
 * @param propertiesName
 * @param schema
 * @param required
 * @returns
 */
export function createProperty(
  propertiesName: string,
  schema: Schema,
  required?: boolean
) {
  // 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'file'
  let newSchemaType: any = schema.type;
  if (schema.type === "integer") {
    newSchemaType = "number";
  }
  if (schema.type === "array") {
    if (schema.items) {
      const definition = formatSchemaRef((schema.items as Schema)["$ref"]);
      newSchemaType = `${definition}[]`;
    } else {
      newSchemaType = "T[]";
    }
  }
  if (schema.type === "object" || !schema.type && schema['$ref']) {
    const definition = formatSchemaRef(schema["$ref"]);
    newSchemaType = `${definition}`;
  }

  return (
    createPropertyDescription(schema.description) +
    `
    ${propertiesName}${required ? ":" : "?:"} ${newSchemaType};
    `
  );
}

export function createProperties(properties: Schema, required?: string[]) {
  let propertiesStr = "";
  Object.entries(properties).forEach(([propertiesName, schema]) => {
    const propertyStr = createProperty(
      propertiesName,
      schema,
      (required || []).includes(propertiesName)
    );
    propertiesStr = propertiesStr + propertyStr;
  });

  return propertiesStr;
}

export function formatSchemaRef(ref?: string) {
  const newRef = ref?.split("/")[ref?.split("/").length - 1];
  return newRef;
}

function createSynthesizedNode() {
    const node = ts.factory.createNodeArray()
}


