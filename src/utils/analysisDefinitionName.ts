// TODO 有错误
export const analysisDefinitionName = (definitionName: string): string[] => {
  let definitionNames: string[] = [];
  if (definitionName.includes("«") && definitionName.includes("»")) {
    let newDefinitionName = "";
    const firstIndex = definitionName.indexOf("«");
    const lastIndex = definitionName.lastIndexOf("»");
    if (firstIndex > 0) {
      const firstDefinitionName = definitionName.slice(0, firstIndex)
      definitionNames.push(firstDefinitionName);
    }
    if (firstIndex > 0 && lastIndex > firstIndex) {
      const secondDefinitionName = definitionName.slice(firstIndex + 1, lastIndex);
      definitionNames.push(...analysisDefinitionName(secondDefinitionName))
    }
  } else {
    definitionNames = [definitionName];
  }
//   console.log(definitionNames)
  return definitionNames;
};
