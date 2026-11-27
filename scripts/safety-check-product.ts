/**
 * Check a product profile against the Always Safety product register, for CI or a terminal.
 *
 *   npx tsx scripts/safety-check-product.ts path/to/profile.json [--format md|json] [--fail-on high|medium|low|none] [--date YYYY-MM-DD] [--register path]
 *
 * Exit codes: 0 no gaps at or above --fail-on (default high), 1 gaps at or above it, 2 the profile
 * or register is invalid. Prints the report to stdout. Reads only the files given; sends nothing.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assessProduct,
  productReportMarkdown,
  validateProductProfile,
  validateProductRegister,
  type ProductProfile,
  type ProductRegister,
  type Severity,
} from '../packages/core/src/products.js';

const LEVELS: Record<Severity | 'none', number> = { high: 0, medium: 1, low: 2, none: -1 };

function arg(name: string, args: string[]): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

export function run(args: string[], out: (s: string) => void = (s) => process.stdout.write(s)): number {
  const profilePath = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
  if (!profilePath) {
    out('Usage: safety-check-product <profile.json> [--format md|json] [--fail-on high|medium|low|none] [--date YYYY-MM-DD] [--register path]\n');
    return 2;
  }
  const format = arg('format', args) ?? 'md';
  const failOn = (arg('fail-on', args) ?? 'high') as Severity | 'none';
  if (!(failOn in LEVELS) || !['md', 'json'].includes(format)) {
    out('--format must be md or json; --fail-on must be high, medium, low or none\n');
    return 2;
  }
  const registerPath = arg('register', args) ?? fileURLToPath(new URL('../spec/safety/product-register.json', import.meta.url));
  const register = JSON.parse(readFileSync(registerPath, 'utf8')) as ProductRegister;
  const registerProblems = validateProductRegister(register);
  if (registerProblems.length) {
    out(`The register is invalid:\n${registerProblems.map((p) => `- ${p}`).join('\n')}\n`);
    return 2;
  }
  const profile = JSON.parse(readFileSync(profilePath, 'utf8')) as ProductProfile;
  const profileProblems = validateProductProfile(profile);
  if (profileProblems.length) {
    out(`The profile is invalid:\n${profileProblems.map((p) => `- ${p}`).join('\n')}\n`);
    return 2;
  }
  const date = arg('date', args);
  const asOf = date ? new Date(`${date}T00:00:00Z`) : new Date();
  if (Number.isNaN(asOf.getTime())) {
    out('--date must be YYYY-MM-DD\n');
    return 2;
  }
  const assessment = assessProduct(register, profile, asOf);
  out(format === 'json' ? `${JSON.stringify(assessment, null, 2)}\n` : productReportMarkdown(assessment));
  if (failOn === 'none') return 0;
  const failing = assessment.findings.filter((f) => f.status === 'gap' && LEVELS[f.severity] <= LEVELS[failOn]);
  return failing.length ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = run(process.argv.slice(2));
}
