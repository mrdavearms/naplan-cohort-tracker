/**
 * Pure statistical helpers, hand-ported to match the Python oracle exactly:
 *  - `wilsonCi`            ≙ statsmodels `proportion_confint(method="wilson")`
 *  - `mcnemarExactPValue`  ≙ statsmodels `mcnemar(table, exact=True).pvalue`
 *
 * No I/O, no dependencies. Validated against `verification/verify_cohort.py`
 * and the cases in the legacy `tests/test_cohort.py`.
 */

/**
 * Inverse standard-normal CDF (quantile function) — Wichura (1988) AS241
 * PPND16. Accurate to ~1e-16, so the Wilson bounds match scipy/statsmodels to
 * machine precision rather than relying on a looser approximation.
 */
export function normInv(p: number): number {
  if (Number.isNaN(p)) return NaN;
  if (p <= 0) return p === 0 ? -Infinity : NaN;
  if (p >= 1) return p === 1 ? Infinity : NaN;

  // Numerator coefficients have 8 terms; denominators have 7 + an implicit 1.
  const a = [
    3.387132872796366608e0, 1.3314166789178437745e2, 1.9715909503065514427e3,
    1.3731693765509461125e4, 4.5921953931549871457e4, 6.7265770927008700853e4,
    3.3430575583588128105e4, 2.5090809287301226727e3,
  ];
  const b = [
    4.2313330701600911252e1, 6.871870074920579083e2, 5.3941960214247511077e3,
    2.1213794301586595867e4, 3.930789580009271061e4, 2.8729085735721942674e4,
    5.226495278852854561e3,
  ];
  const c = [
    1.42343711074968357734e0, 4.6303378461565452959e0, 5.7694972214606914055e0,
    3.64784832476320460504e0, 1.27045825245236838258e0, 2.4178072517745061177e-1,
    2.27238449892691845833e-2, 7.7454501427834140764e-4,
  ];
  const d = [
    2.05319162663775882187e0, 1.6763848301838038494e0, 6.8976733498510000455e-1,
    1.4810397642748007459e-1, 1.51986665636164571966e-2, 5.475938084995344946e-4,
    1.05075007164441684324e-9,
  ];
  const e = [
    6.6579046435011037772e0, 5.4637849111641143699e0, 1.7848265399172913358e0,
    2.9656057182850489123e-1, 2.6532189526576123093e-2, 1.2426609473880784386e-3,
    2.71155556874348757815e-5, 2.01033439929228813265e-7,
  ];
  const f = [
    5.9983220655588793769e-1, 1.3692988092273580531e-1, 1.48753612908506148525e-2,
    7.868691311456132591e-4, 1.8463183175100546818e-5, 1.4215117583164458887e-7,
    2.04426310338993978564e-15,
  ];

  const q = p - 0.5;
  let r: number;
  if (Math.abs(q) <= 0.425) {
    r = 0.180625 - q * q;
    const num =
      ((((((a[7]! * r + a[6]!) * r + a[5]!) * r + a[4]!) * r + a[3]!) * r + a[2]!) * r + a[1]!) * r + a[0]!;
    const den =
      ((((((b[6]! * r + b[5]!) * r + b[4]!) * r + b[3]!) * r + b[2]!) * r + b[1]!) * r + b[0]!) * r + 1;
    return (q * num) / den;
  }

  r = q < 0 ? p : 1 - p;
  r = Math.sqrt(-Math.log(r));
  let val: number;
  if (r <= 5) {
    r -= 1.6;
    const num =
      ((((((c[7]! * r + c[6]!) * r + c[5]!) * r + c[4]!) * r + c[3]!) * r + c[2]!) * r + c[1]!) * r + c[0]!;
    const den =
      ((((((d[6]! * r + d[5]!) * r + d[4]!) * r + d[3]!) * r + d[2]!) * r + d[1]!) * r + d[0]!) * r + 1;
    val = num / den;
  } else {
    r -= 5;
    const num =
      ((((((e[7]! * r + e[6]!) * r + e[5]!) * r + e[4]!) * r + e[3]!) * r + e[2]!) * r + e[1]!) * r + e[0]!;
    const den =
      ((((((f[6]! * r + f[5]!) * r + f[4]!) * r + f[3]!) * r + f[2]!) * r + f[1]!) * r + f[0]!) * r + 1;
    val = num / den;
  }
  return q < 0 ? -val : val;
}

/**
 * Wilson score confidence interval on a proportion. Returns [lower, upper] as
 * fractions in [0, 1]. Returns [0, 0] for n = 0, matching the oracle.
 */
export function wilsonCi(successes: number, n: number, alpha = 0.05): [number, number] {
  if (n === 0) return [0, 0];
  const p = successes / n;
  const z = normInv(1 - alpha / 2);
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return [center - half, center + half];
}

/** P(X ≤ k) for X ~ Binomial(n, 0.5). Iterative to stay overflow-free at n ~ 100. */
export function binomCdfHalf(k: number, n: number): number {
  if (k < 0) return 0;
  if (k >= n) return 1;
  let term = Math.pow(0.5, n); // pmf(0)
  let sum = term;
  for (let i = 1; i <= k; i++) {
    term *= (n - i + 1) / i; // C(n,i-1) -> C(n,i)
    sum += term;
  }
  return sum;
}

/**
 * Two-sided exact McNemar p-value on the discordant counts, matching
 * statsmodels' convention: min(1, 2 · BinomCdf(min(n12, n21), n12 + n21, 0.5)).
 * Returns NaN for zero discordant pairs — callers treat that as "not applicable".
 */
export function mcnemarExactPValue(n12: number, n21: number): number {
  const nDiscordant = n12 + n21;
  if (nDiscordant === 0) return NaN;
  const k = Math.min(n12, n21);
  return Math.min(1, 2 * binomCdfHalf(k, nDiscordant));
}
