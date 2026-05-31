export const STACK_OPTIONS = [
  { value: "backend", label: "backend" },
  { value: "ai-ml", label: "ai / ml" },
  { value: "platform", label: "platform" },
  { value: "devops", label: "devops · sre" },
  { value: "frontend", label: "frontend" },
  { value: "fullstack", label: "fullstack" },
];

export const STACK_VALUES = new Set(STACK_OPTIONS.map((o) => o.value));

export const KEYWORD_SUGGESTIONS = ["Python", "TypeScript", "PostgreSQL", "PyTorch", "Terraform", "React"];

export const AUTH_SUGGESTIONS = ["US", "UK", "CA", "DE", "PT", "FR", "NL", "PL", "UA", "IE", "SE", "AU", "IN", "SG", "BR"];

export const AUTH_COUNTRY_LIST: [string, string][] = [
  ["US", "United States"],
  ["UK", "United Kingdom"],
  ["CA", "Canada"],
  ["DE", "Germany"],
  ["PT", "Portugal"],
  ["FR", "France"],
  ["NL", "Netherlands"],
  ["ES", "Spain"],
  ["PL", "Poland"],
  ["UA", "Ukraine"],
  ["IE", "Ireland"],
  ["SE", "Sweden"],
  ["CH", "Switzerland"],
  ["AU", "Australia"],
  ["IN", "India"],
  ["SG", "Singapore"],
  ["BR", "Brazil"],
  ["JP", "Japan"],
  ["MX", "Mexico"],
  ["EU", "EU (any member state)"],
];
