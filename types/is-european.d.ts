declare module "is-european" {
  export function euMember(alpha2: string): boolean;
  export function eeaMember(alpha2: string): boolean;
  export function getCountry(alpha2: string): { state: string; alpha2: string; alpha3: string; numeric: string; name: string } | undefined;
}
