import nodeFetch from "node-fetch";
import { swaggerConfigs } from "./config/swagger";
import { Generator } from "./Generator";
import ts from "typescript";

function run() {
  swaggerConfigs.forEach(async (swaggerConfig, index) => {
    const { url, paths } = swaggerConfig;
    const res = await nodeFetch(url);

    const spec = await res.json();
    const gen = new Generator(spec, paths);
    gen.generate();
    const definitions = gen.definitions
    gen.generateDefinitions(definitions)
    // gen.getAllDefinitions()
    // gen.generateDefinitions();
    

    // console.log('definitions', gen.filterDefinitions())
  });
}
run();
