declare module "prismjs/components/prism-core" {
  export function highlight(
    code: string,
    grammar: Prism.Grammar,
    language: string,
  ): string;
  export const languages: Record<string, Prism.Grammar>;
}

declare module "prismjs/components/prism-python" {}
