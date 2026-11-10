#!/usr/bin/env python3
"""Every number in "Black Holes, True Vacuum, and Cosmic Fabric: Doing the Sums".

    https://dhilipsiva.dev/musings/black-holes-true-vacuum/

Run:  python3 numbers.py           print each number and each check
      python3 numbers.py --json    the same, machine-readable

The page is filled from this script's output when it is generated
(scripts/render_math.py), so the page cannot disagree with the computation.
Where a result can be reached two ways, by algebra and by a numerical integral
or search, both are computed here and asserted to agree. Stdlib only.

Symbols follow the essay: sigma is the energy per unit area of a wall or shell,
epsilon the energy density by which one vacuum undercuts another, r_s = 2GM/c^2.
"""
import json
import math
import sys

# CODATA 2018 constants, SI units. The solar mass follows from the IAU nominal
# value of G*M_sun, which is known far better than G or M_sun separately.
G = 6.67430e-11           # m^3 kg^-1 s^-2
C = 2.99792458e8          # m/s
HBAR = 1.054571817e-34    # J s
KB = 1.380649e-23         # J/K
M_SUN = 1.3271244e20 / G  # kg
M_MOON = 7.342e22         # kg
GEV = 1.602176634e-10     # J
AU = 1.495978707e11       # m
MPC = 3.0856775814913673e22  # m
YEAR = 3.15576e7          # s
L_PLANCK = math.sqrt(G * HBAR / C**3)             # m
T_PLANCK = math.sqrt(HBAR * C**5 / G) / KB        # K
T_CMB = 2.725             # K, the microwave background today
ZETA3 = sum(1 / n**3 for n in range(1, 200001))   # Riemann zeta(3)

NUMBERS = {}  # key -> {"value", "text", "tex", "what"}
CHECKS = []   # {"name", "ok", "detail"}

_SUPERSCRIPT = str.maketrans("-0123456789", "⁻⁰¹²³⁴⁵⁶⁷⁸⁹")


def fmt(value, sig):
    """Return (plain text, TeX) for `value` rounded to `sig` significant figures."""
    exp = math.floor(math.log10(abs(value)))
    mantissa = round(value / 10**exp, sig - 1)
    if abs(mantissa) >= 10:  # 9.96 rounds up to 10.0
        mantissa, exp = mantissa / 10, exp + 1
    if -3 <= exp < 5:
        decimals = max(sig - 1 - exp, 0)
        fixed = f"{round(value, sig - 1 - exp):,.{decimals}f}"
        return fixed, fixed.replace(",", "{,}")
    power = f"10{str(exp).translate(_SUPERSCRIPT)}", f"10^{{{exp}}}"
    if sig == 1 and mantissa == 1:  # write 10⁴⁴, not 1×10⁴⁴
        return power
    digits = f"{mantissa:.{sig - 1}f}"
    return f"{digits}×{power[0]}", f"{digits}\\times{power[1]}"


def number(key, value, sig, what):
    text, tex = fmt(value, sig)
    NUMBERS[key] = {"value": value, "text": text, "tex": tex, "what": what}
    return value


def check(name, ok, detail=""):
    CHECKS.append({"name": name, "ok": bool(ok), "detail": detail})


def close(a, b, rel=1e-9):
    return abs(a - b) <= rel * max(abs(a), abs(b))


def simpson(f, a, b, n):
    """Composite Simpson's rule with n (even) intervals."""
    h = (b - a) / n
    total = f(a) + f(b)
    for i in range(1, n):
        total += (4 if i % 2 else 2) * f(a + i * h)
    return total * h / 3


def bisect(f, lo, hi, steps=200):
    """Root of f on [lo, hi] by bisection in log space; f must change sign."""
    f_lo = f(lo)
    for _ in range(steps):
        mid = math.sqrt(lo * hi)
        if (f(mid) > 0) == (f_lo > 0):
            lo = mid
        else:
            hi = mid
    return math.sqrt(lo * hi)


# --- Black-hole basics -------------------------------------------------------

def schwarzschild_radius(m):
    return 2 * G * m / C**2


def mean_density(m):
    """Mass over the volume of a Euclidean sphere of radius r_s: 3c^6/(32 pi G^3 M^2)."""
    return m / (4 / 3 * math.pi * schwarzschild_radius(m) ** 3)


def tidal_gradient(m):
    """Radial tidal stretching 2GM/r^3 at r = r_s, in s^-2: c^6/(4 G^2 M^2)."""
    return C**6 / (4 * G**2 * m**2)


def fall_time(m):
    """Longest proper time from the horizon to the centre of a non-rotating hole."""
    return math.pi * G * m / C**3


def hawking_temperature(m):
    return HBAR * C**3 / (8 * math.pi * G * m * KB)


def entropy_over_kb(m):
    """Bekenstein-Hawking entropy A/(4 l_p^2), in units of k_B."""
    return 4 * math.pi * schwarzschild_radius(m) ** 2 / (4 * L_PLANCK**2)


# --- 1. The bubble wall ------------------------------------------------------

def section_bubble():
    # Units: sigma = 1, epsilon = 1, c = 1.
    sigma = epsilon = 1.0

    def energy(r, gamma):
        return 4 * math.pi * sigma * r**2 * gamma - 4 / 3 * math.pi * epsilon * r**3

    r0 = 3 * sigma / epsilon
    check("bubble: a resting bubble of radius 3 sigma/epsilon costs no energy", abs(energy(r0, 1.0)) < 1e-12)

    # Energy conservation alone fixes the wall's Lorentz factor: gamma = R/R0.
    for k in (1.5, 10.0, 1e6):
        gamma = bisect(lambda g: energy(k * r0, g), 1e-3, 1e9)
        check(f"bubble: energy conservation gives gamma = R/R0 at R = {k:g} R0", close(gamma, k, 1e-9), f"gamma = {gamma:.9g}")

    # Coleman's solution R^2 - t^2 = R0^2 is the same statement.
    for t in (0.5, 4.0, 300.0):
        r = math.hypot(r0, t)
        speed = t / r
        check(f"bubble: Coleman's hyperbola has gamma = R/R0 at t = {t:g}", close(1 / math.sqrt(1 - speed**2), r / r0, 1e-9))

    # A resting wall balances at 2 sigma/epsilon, and that balance is a maximum.
    r_static = 2 * sigma / epsilon
    h = 1e-4
    slope = (energy(r_static + h, 1) - energy(r_static - h, 1)) / (2 * h)
    curvature = (energy(r_static + h, 1) - 2 * energy(r_static, 1) + energy(r_static - h, 1)) / h**2
    check("bubble: the resting balance point is 2 sigma/epsilon", abs(slope) < 1e-6, f"dE/dR = {slope:.2e}")
    check("bubble: that balance is a maximum of the energy (unstable)", curvature < 0, f"d2E/dR2 = {curvature:.4f}")


# --- 2. A horizon has no built-in scale --------------------------------------

HOLES = {  # key -> (mass in solar masses, description)
    "3": (3.0, "a small stellar black hole"),
    "62": (62.0, "the remnant of GW150914"),
    "sgr": (4.3e6, "Sgr A*, at the centre of our galaxy"),
    "m87": (6.5e9, "M87*, the first black hole photographed"),
}


def section_horizon():
    for key, (solar, what) in HOLES.items():
        m = solar * M_SUN
        rs = schwarzschild_radius(m)
        number(f"rho_{key}", mean_density(m), 2, f"mean density in kg/m^3, {what}")
        number(f"stretch_{key}", tidal_gradient(m) * 2.0, 2, f"difference in gravity across 2 m at the horizon, m/s^2, {what}")
        check(f"horizon: closed form of the mean density, {what}", close(mean_density(m), 3 * C**6 / (32 * math.pi * G**3 * m**2), 1e-12))
        check(f"horizon: closed form of the tidal gradient, {what}", close(tidal_gradient(m), 2 * G * m / rs**3, 1e-12))

    m3, m62, sgr, m87 = (HOLES[k][0] * M_SUN for k in ("3", "62", "sgr", "m87"))
    number("rs_km_3", schwarzschild_radius(m3) / 1e3, 2, "Schwarzschild radius, 3 solar masses, km")
    number("rs_km_62", schwarzschild_radius(m62) / 1e3, 2, "Schwarzschild radius, 62 solar masses, km")
    number("rs_mkm_sgr", schwarzschild_radius(sgr) / 1e9, 2, "Schwarzschild radius of Sgr A*, millions of km")
    number("rs_au_m87", schwarzschild_radius(m87) / AU, 2, "Schwarzschild radius of M87*, astronomical units")
    number("fall_us_3", fall_time(m3) * 1e6, 2, "longest fall from horizon to centre, 3 solar masses, microseconds")
    number("fall_ms_62", fall_time(m62) * 1e3, 2, "the same, 62 solar masses, milliseconds")
    number("fall_s_sgr", fall_time(sgr), 2, "the same, Sgr A*, seconds")
    number("fall_h_m87", fall_time(m87) / 3600, 2, "the same, M87*, hours")
    number("density_span", mean_density(m3) / mean_density(m87), 2, "mean density at 3 solar masses over mean density of M87*")
    number("mass_water", math.sqrt(mean_density(M_SUN) / 1000.0), 2, "solar masses at which the mean density equals water's")
    number("rho_nuclear", 2.3e17, 2, "nuclear saturation density in kg/m^3 (reference value)")
    number("rho_3_nuclear", mean_density(m3) / 2.3e17, 2, "mean density at 3 solar masses in units of nuclear density")
    number("rho_air", 1.2, 2, "air at sea level in kg/m^3 (reference value)")

    # A shell collapsing at light speed: the horizon starts at the centre while
    # the shell is at 2 r_s and grows at c through the flat interior, reaching
    # r_s as the shell does. It is born r_s/c before the shell crosses r_s.
    number("headstart_h_m87", schwarzschild_radius(m87) / C / 3600, 2, "hours by which the horizon precedes a light-speed shell, M87*")


# --- 3. A different vacuum inside --------------------------------------------

def wall_potential(r, m, a, kappa):
    """Effective potential of a pure-tension wall, G = c = 1.

    Inside: anti-de Sitter, f = 1 + r^2/l^2. Outside: Schwarzschild, f = 1 - 2m/r.
    The wall's sigma is constant (pure tension), kappa = 4 pi sigma, and
    a = (1/l^2 - kappa^2) / (2 kappa). Israel's junction condition
        sqrt(f_in + R'^2) - sqrt(f_out + R'^2) = kappa R
    rearranges to R'^2 + V(R) = 0 with the V returned here. The wall can only be
    where V <= 0, and it can sit still only where V = 0 and dV/dR = 0.
    """
    return (1 - 2 * m / r) - (a * r + m / (kappa * r * r)) ** 2


def wall_balance(tension_fraction):
    """The one mass at which a bare wall can sit still, for tension = fraction * critical.

    Lengths are in units of the anti-de Sitter radius l. Returns (m, r, r0, curvature):
    the mass, the wall radius, the bubble's own critical radius R0 = 1/a (the
    radius at which it would nucleate with no mass present), and d2V/dR2 there.
    """
    kappa = tension_fraction  # the critical tension is kappa = 1/l
    a = (1 - kappa**2) / (2 * kappa)
    r0 = 1 / a

    def peak(m):
        """(max of V over R, the R where it is reached)."""
        lo, hi = math.log(1e-9 * r0), math.log(1e3 * r0)
        n = 600
        best = max(range(n + 1), key=lambda i: wall_potential(math.exp(lo + (hi - lo) * i / n), m, a, kappa))
        left = lo + (hi - lo) * max(best - 1, 0) / n
        right = lo + (hi - lo) * min(best + 1, n) / n
        golden = (math.sqrt(5) - 1) / 2
        for _ in range(80):
            x1, x2 = right - golden * (right - left), left + golden * (right - left)
            if wall_potential(math.exp(x1), m, a, kappa) > wall_potential(math.exp(x2), m, a, kappa):
                right = x2
            else:
                left = x1
        r = math.exp((left + right) / 2)
        return wall_potential(r, m, a, kappa), r

    # The barrier's height falls as the mass grows; balance is where it touches zero.
    m = bisect(lambda mass: peak(mass)[0], 1e-12 * r0, 1e3 * r0, steps=90)
    r = peak(m)[1]
    h = 1e-3 * r
    curvature = (wall_potential(r + h, m, a, kappa) - 2 * wall_potential(r, m, a, kappa) + wall_potential(r - h, m, a, kappa)) / h**2
    return m, r, r0, curvature


def section_vacuum():
    # A de Sitter interior that just fills the hole (its horizon radius equals
    # r_s) must have vacuum density 3c^2/(8 pi G r_s^2). That equals the mean density.
    for solar, what in HOLES.values():
        m = solar * M_SUN
        rho_v = 3 * C**2 / (8 * math.pi * G * schwarzschild_radius(m) ** 2)
        check(f"vacuum: de Sitter density that fills the hole equals the mean density, {what}", close(rho_v, mean_density(m), 1e-12))

    # Dark energy today, from the Planck 2018 values H0 = 67.4 km/s/Mpc, Omega_Lambda = 0.685.
    h0 = 67.4e3 / MPC
    number("rho_lambda", 0.685 * 3 * h0**2 / (8 * math.pi * G), 1, "dark-energy density in kg/m^3")

    # A vacuum lower than ours by epsilon is anti-de Sitter space with radius
    # l = sqrt(3 c^4/(8 pi G epsilon)). For an energy scale E, epsilon = E^4/(hbar c)^3.
    def ads_radius(energy_gev):
        epsilon = (energy_gev * GEV) ** 4 / (HBAR * C) ** 3
        return math.sqrt(3 * C**4 / (8 * math.pi * G * epsilon))

    l_strong, l_higgs, l_example = ads_radius(0.2), ads_radius(100.0), 1e-18
    number("ell_qcd_km", l_strong / 1e3, 2, "anti-de Sitter radius for an energy scale of 0.2 GeV, km")
    number("ell_ew_cm", l_higgs * 1e2, 2, "the same for 100 GeV, cm")
    epsilon_example = 3 * C**4 / (8 * math.pi * G * l_example**2)
    number("ell_scale_gev", (epsilon_example * (HBAR * C) ** 3) ** 0.25 / GEV, 1, "energy scale whose anti-de Sitter radius is 1e-18 m, GeV")

    # The critical tension c^4/(4 pi G l), as a mass per area, for l = 1e-18 m,
    # and how much smaller the hole's own term is for 3 solar masses.
    number("sigma_c", C**2 / (4 * math.pi * G * l_example), 1, "critical wall tension for l = 1e-18 m, kg/m^2")
    number("wall_fraction", l_example / schwarzschild_radius(3 * M_SUN), 1, "l/r_s for l = 1e-18 m and 3 solar masses")

    # The bare wall, at tensions from 1% to 99.9% of critical. V is concave
    # everywhere: with B = aR + m/(kappa R^2), V'' = -4m/R^3 - 2B'^2 - 2BB'' and
    # every term is negative. So V has one maximum, any balance point is that
    # maximum, and the balance is unstable. Checked on a grid, against differences.
    results = {f: wall_balance(f) for f in (0.01, 0.1, 0.5, 0.9, 0.99, 0.999)}
    for f, (m_star, _, r0, _) in results.items():
        a = (1 - f**2) / (2 * f)
        concave = matches = True
        for mass in (0.3 * m_star, m_star, 3 * m_star):
            for i in range(121):
                r = r0 * 10 ** (-4 + 6 * i / 120)
                b, db, ddb = a * r + mass / (f * r**2), a - 2 * mass / (f * r**3), 6 * mass / (f * r**4)
                analytic = -4 * mass / r**3 - 2 * db**2 - 2 * b * ddb
                h = 1e-3 * r
                numeric = (wall_potential(r + h, mass, a, f) - 2 * wall_potential(r, mass, a, f) + wall_potential(r - h, mass, a, f)) / h**2
                concave = concave and analytic < 0
                matches = matches and close(analytic, numeric, 1e-3)
        check(f"wall: V is concave at every radius, so the balance is unstable ({f:g} of critical tension)", concave and matches)
    ratios = [2 * m / r0 for m, _, r0, _ in results.values()]
    check("wall: the balancing hole grows with tension but never beyond 2/(3 sqrt 3) of R0", all(x < y for x, y in zip(ratios, ratios[1:])) and ratios[-1] < 2 / (3 * math.sqrt(3)), f"r_s/R0 = {', '.join(f'{x:.4g}' for x in ratios)}")
    check("wall: a balanced wall is always outside the photon sphere, R > 1.5 r_s", all(r / (2 * m) > 1.5 for m, r, _, _ in results.values()))
    m, r, r0, _ = results[0.999]
    check("wall: near critical tension the wall approaches the photon sphere", close(r / (2 * m), 1.5, 2e-3) and close(2 * m / r0, 2 / (3 * math.sqrt(3)), 2e-3), f"R/r_s = {r / (2 * m):.4f}, r_s/R0 = {2 * m / r0:.4f}")
    # Weak tension, kappa = k/l: flat space again. The wall sits at section 1's
    # 2 sigma/epsilon = (2/3) R0, and the mass is the energy of that resting
    # bubble, 16 pi sigma^3/(3 epsilon^2), which is (16/27) k^3 l in these units.
    m, r, r0, _ = results[0.01]
    check("wall: at weak tension the balance is the flat-space one, R = (2/3) R0", close(r / r0, 2 / 3, 1e-3), f"R/R0 = {r / r0:.5f}")
    check("wall: at weak tension the mass is the energy of the flat-space resting bubble", close(m, 16 / 27 * 0.01**3, 1e-3), f"{m:.6e} against {16 / 27 * 0.01**3:.6e}")
    m, r, r0, _ = results[0.5]
    number("wall_half_r", r / (2 * m), 2, "R/r_s of the balanced wall at half the critical tension")

    # A wall whose tension comes from the vacuum's own energy scale E,
    # sigma = E^3/(hbar c)^2 with epsilon = E^4/(hbar c)^3, is far below the
    # critical tension. Its one mass is then the flat-space resting bubble's:
    # (16 pi/3) sigma^3/epsilon^2 = (16 pi/3) E, a few particles' worth.
    number("wall_mass_natural", 16 * math.pi / 3, 2, "balance mass of a wall at the vacuum's own scale E, in units of E/c^2")
    fraction = (100.0 * GEV) ** 3 / (HBAR * C) ** 2 / (C**4 / (4 * math.pi * G * l_higgs))
    check("wall: a wall at the vacuum's own scale is far below critical tension (100 GeV)", fraction < 1e-10, f"sigma/sigma_critical = {fraction:.2g}")


# --- 4. What a fabric would have to be ---------------------------------------

def shell_sigma(r, m):
    """Energy per area of a static shell, flat inside, Schwarzschild outside (G = c = 1)."""
    return (1 - math.sqrt(1 - 2 * m / r)) / (4 * math.pi * r)


def shell_pressure(r, m):
    """Its surface pressure, from the second junction condition (G = c = 1)."""
    s = math.sqrt(1 - 2 * m / r)
    return ((1 - m / r) / s - 1) / (8 * math.pi * r)


def section_fabric():
    # Newtonian limit of the shell: far from r_s its mass is 4 pi R^2 sigma.
    check("shell: far from r_s the shell's mass is 4 pi R^2 sigma", close(4 * math.pi * 1e8**2 * shell_sigma(1e8, 1.0), 1.0, 1e-7))

    # p/sigma = (1 - s)/(4 s) with s = sqrt(1 - r_s/R), so a shell with
    # p = w sigma balances only at R/r_s = 1/(1 - 1/(1 + 4w)^2).
    for w, expected in ((0.5, 9 / 8), (1.0, 25 / 24), (1 / 3, 49 / 40)):
        r = bisect(lambda x: shell_pressure(x, 1.0) / shell_sigma(x, 1.0) - w, 2 * (1 + 1e-9), 2e6)
        closed = 1 / (1 - 1 / (1 + 4 * w) ** 2)
        check(f"shell: with p = {w:.3g} sigma it balances at {expected:.6g} r_s", close(r / 2, closed, 1e-9) and close(closed, expected, 1e-12), f"numerical {r / 2:.9f}, closed form {closed:.9f}")

    # Balance is not stability. A moving shell obeys R'^2 + V = 0 with
    # V = 1 - (M/m + m/(2R))^2, where m = 4 pi R^2 sigma is the shell's own mass
    # and p = w sigma makes m fall as R^(-2w). At the balance point V = V' = 0
    # and V'' = -(2w + 1)(4w + 1) m/R^3, negative for every w > 0.
    for w in (0.1, 1 / 3, 0.5, 1.0, 2.0):
        s = 1 / (1 + 4 * w)
        r_eq = 2 / (1 - s * s)  # M = 1, so r_s = 2
        m_eq = r_eq * (1 - s)

        def potential(r, w=w, r_eq=r_eq, m_eq=m_eq):
            m_shell = m_eq * (r / r_eq) ** (-2 * w)
            return 1 - (1 / m_shell + m_shell / (2 * r)) ** 2

        h = 1e-4 * r_eq
        slope = (potential(r_eq + h) - potential(r_eq - h)) / (2 * h)
        curvature = (potential(r_eq + h) - 2 * potential(r_eq) + potential(r_eq - h)) / h**2
        check(f"shell: with p = {w:.3g} sigma the balance point has V = V' = 0", abs(potential(r_eq)) < 1e-12 and abs(slope) < 1e-6, f"V = {potential(r_eq):.1e}, V' = {slope:.1e}")
        expected = -(2 * w + 1) * (4 * w + 1) * m_eq / r_eq**3
        check(f"shell: with p = {w:.3g} sigma the balance is a maximum of V (unstable on its own)", curvature < 0 and close(curvature, expected, 1e-4), f"d2V/dR2 = {curvature:.4f}, closed form {expected:.4f}")

    number("entropy_sun", entropy_over_kb(M_SUN), 3, "Bekenstein-Hawking entropy of one solar mass, in units of k_B")

    # A static observer at proper distance x from the horizon sees T = hbar c/(2 pi k_B x).
    def local_temperature(x):
        return HBAR * C / (2 * math.pi * KB * x)

    number("T_1mm", local_temperature(1e-3), 2, "temperature seen hovering 1 mm above a horizon, K")
    number("T_1um", local_temperature(1e-6), 2, "the same 1 micrometre above, K")
    number("T_1nm", local_temperature(1e-9), 2, "the same 1 nanometre above, K")
    # It is the Hawking temperature, blueshifted: check on a 10-solar-mass hole at 1 m.
    m = 10 * M_SUN
    rs = schwarzschild_radius(m)
    delta = 1.0**2 / (4 * rs)  # coordinate height whose proper distance is 1 m
    check("fabric: the local temperature is Hawking's, blueshifted", close(hawking_temperature(m) / math.sqrt(delta / (rs + delta)), local_temperature(1.0), 1e-4))

    # 't Hooft's brick wall. One massless field in equilibrium outside the hole
    # has entropy density (2 pi^2/45) T^3 (units k_B = hbar = c = 1). Summed
    # down to a wall at proper distance d it gives S = A/(360 pi d^2).
    # Checked here by integrating over the exact geometry, G = M = 1.
    # The closed form: S = A/(360 pi d^2), equal to A/(4 l_p^2) at d = l_p/sqrt(90 pi).
    d_planck = 1 / math.sqrt(90 * math.pi)  # in Planck lengths
    number("eps_lp", d_planck, 2, "wall height in Planck lengths for one massless field")
    number("eps_lp_100", math.sqrt(100 / (90 * math.pi)), 2, "the same for 100 fields")
    number("T_wall_planck", local_temperature(d_planck * L_PLANCK) / T_PLANCK, 2, "local temperature at the wall in Planck temperatures")

    # Checked by integrating over the exact geometry (Planck units, G = c = 1):
    # put the wall at that proper distance, add up the entropy and the energy
    # of the gas out to r = 3M, and compare with A/4 and (3/8) M for two masses.
    for mass in (1e3, 1e6):
        t_hawking, area = 1 / (8 * math.pi * mass), 16 * math.pi * mass**2

        def proper_distance(delta, mass=mass):
            return math.sqrt((2 * mass + delta) * delta) + 2 * mass * math.atanh(math.sqrt(delta / (2 * mass + delta)))

        height = bisect(lambda x: proper_distance(x) - d_planck, 1e-30, 1.0)  # coordinate height of the wall

        def integrand(u, mass=mass):  # r = 2M + e^u; the factor e^u is dr/du
            delta = math.exp(u)
            r = 2 * mass + delta
            f = delta / r  # 1 - 2M/r, written so that it does not cancel
            return 4 * math.pi * r**2 / f**2 * delta

        optical_volume = simpson(integrand, math.log(height), math.log(mass), 40000)
        entropy = 2 * math.pi**2 / 45 * t_hawking**3 * optical_volume
        energy = math.pi**2 / 30 * t_hawking**4 * optical_volume
        check(f"brick wall: integrated entropy is A/4 with the wall at l_p/sqrt(90 pi) (M = {mass:g} Planck masses)", close(entropy, area / 4, 1e-4), f"ratio {entropy / (area / 4):.6f}")
        check(f"brick wall: integrated energy of the layer is 3/8 of the mass (M = {mass:g} Planck masses)", close(energy, 3 * mass / 8, 1e-4), f"E/M = {energy / mass:.6f}")


# --- 5. The 2017 black shell --------------------------------------------------

def section_black_shell():
    # Danielsson, Dibitetto, Giri (2017), G = c = hbar = k_B = 1, M = 1.
    m = 1.0
    r = 9 * m / 4
    s = math.sqrt(1 - 2 * m / r)
    check("black shell: sqrt(1 - r_s/R) = 1/3 at R = 9/8 r_s", close(s, 1 / 3, 1e-12))

    # Their gas sits at the Unruh temperature of the shell's own acceleration.
    t_local = m / (2 * math.pi * r**2 * s)
    t_infinity = t_local * s
    t_hawking = 1 / (8 * math.pi * m)
    check("black shell: seen from far away its temperature is 64/81 of Hawking's", close(t_infinity / t_hawking, 64 / 81, 1e-12))

    # dE = T dS with E = M and T = 8/(81 pi M) gives S = (81 pi/16) M^2 = pi R^2.
    clausius = simpson(lambda x: 81 * math.pi * x / 8, 0.0, m, 100)
    check("black shell: its entropy is the shell's own area over four, 81/64 of a black hole's", close(clausius, math.pi * r**2, 1e-12) and close(clausius / (4 * math.pi * m**2), 81 / 64, 1e-12))

    # Their gas density: sigma_gas = sigma_shell - 1/(12 pi R). It carries 3/4 of the mass.
    gas = shell_sigma(r, m) - 1 / (12 * math.pi * r)
    check("black shell: the gas carries 3/4 of the mass", close(4 * math.pi * r**2 * gas, 0.75, 1e-12))

    # How many kinds of massless quanta does that take? (My arithmetic, not
    # theirs.) The thermal wavelength hbar c/(k_B T) is 3 pi/2 = 4.7 shell radii,
    # so the shell cannot be treated as a flat sheet. Sum the modes of a sphere
    # instead: angular number l, 2l + 1 modes each, frequency nu_l c/R. One
    # species then holds energy (hbar c/R) * sum (2l+1) nu_l/(e^(x nu_l) - 1).
    def mode_sum(x, frequency, first, last):
        return sum((2 * l + 1) * frequency(l) / math.expm1(x * frequency(l)) for l in range(first, last))

    def conformal(l):  # a conformally coupled field
        return l + 0.5

    def minimal(l):  # a minimally coupled field, without its zero mode
        return math.sqrt(l * (l + 1))

    # When the sphere is hot (x small) the sum must turn into the flat-sheet
    # result, 4 zeta(3)/x^3, which rests on the Bose integral 2 zeta(3).
    bose = simpson(lambda y: y**2 / math.expm1(y) if y > 0 else 0.0, 0.0, 60.0, 60000)
    check("black shell: the two-dimensional Bose integral is 2 zeta(3)", close(bose, 2 * ZETA3, 1e-8), f"{bose:.9f} against {2 * ZETA3:.9f}")
    check("black shell: the mode sum becomes the flat-sheet formula when the sphere is hot", close(mode_sum(0.02, conformal, 0, 4000), 4 * ZETA3 / 0.02**3, 1e-3), f"ratio {mode_sum(0.02, conformal, 0, 4000) / (4 * ZETA3 / 0.02**3):.6f}")

    x = 1 / (t_local * r)  # hbar c / (k_B T R)
    check("black shell: the thermal wavelength is 3 pi/2 shell radii", close(x, 3 * math.pi / 2, 1e-12))
    required = r**2 / 3  # gas energy 3M/4 in units of hbar c/R, times l_p^-2 (M = 4R/9)
    scale = (schwarzschild_radius(M_SUN) / L_PLANCK) ** 2 / 4
    number("species_low", required / mode_sum(x, conformal, 0, 60) * scale, 1, "species for one solar mass, conformally coupled field")
    number("species_high", required / mode_sum(x, minimal, 1, 60) * scale, 1, "the same for a minimally coupled field without its zero mode")
    number("shell_au_m87", 2 * 9 / 8 * schwarzschild_radius(6.5e9 * M_SUN) / AU, 2, "diameter of a 9/8 r_s shell for M87*, AU")


# --- 6. Hawking radiation ------------------------------------------------------

def section_hawking():
    t_sun = number("T_H_sun", hawking_temperature(M_SUN), 2, "Hawking temperature of one solar mass, K")
    number("cmb_ratio", T_CMB / t_sun, 2, "microwave background temperature over the Hawking temperature of one solar mass")
    m_equal = HBAR * C**3 / (8 * math.pi * G * KB * T_CMB)
    number("m_cmb_kg", m_equal, 2, "mass whose Hawking temperature equals the microwave background, kg")
    number("m_cmb_moon", m_equal / M_MOON, 2, "the same in lunar masses")
    # Textbook estimates for a hole radiating only photons from its horizon area.
    number("hawking_power_sun", HBAR * C**6 / (15360 * math.pi * G**2 * M_SUN**2), 1, "power radiated by one solar mass, W")
    number("evaporation_years_sun", 5120 * math.pi * G**2 * M_SUN**3 / (HBAR * C**4) / YEAR, 1, "time for one solar mass to evaporate, years")
    check("hawking: T_H * S_BH = M c^2 / 2", close(hawking_temperature(M_SUN) * KB * entropy_over_kb(M_SUN), M_SUN * C**2 / 2, 1e-9))


# --- 7. Echoes -----------------------------------------------------------------

def echo_delay(m, d):
    """Round trip, in far-away time, between the photon sphere and a mirror at
    proper distance d above r_s: (2 r_s/c) [2 ln(r_s/d) + ln 2 + 1/2]."""
    rs = schwarzschild_radius(m)
    return 2 * rs / C * (2 * math.log(rs / d) + math.log(2) + 0.5)


def section_echoes():
    m = 62 * M_SUN
    rs = schwarzschild_radius(m)

    # The same delay from the tortoise coordinate r* = r + r_s ln(r/r_s - 1),
    # with the mirror's coordinate height found from its exact proper distance.
    def proper_distance(delta):
        return math.sqrt((rs + delta) * delta) + rs * math.atanh(math.sqrt(delta / (rs + delta)))

    delta = bisect(lambda x: proper_distance(x) - L_PLANCK, 1e-300, 1.0)
    exact = 2 / C * ((1.5 * rs + rs * math.log(0.5)) - (rs + delta + rs * math.log(delta / rs)))
    check("echo: the closed form matches the tortoise-coordinate round trip", close(exact, echo_delay(m, L_PLANCK), 1e-9), f"{exact:.9f} s against {echo_delay(m, L_PLANCK):.9f} s")

    number("rs_over_lp_62", rs / L_PLANCK, 2, "r_s over the Planck length, 62 solar masses")
    number("ln_62", math.log(rs / L_PLANCK), 2, "its natural logarithm")
    number("echo_62", echo_delay(m, L_PLANCK), 2, "echo delay, 62 solar masses, mirror one Planck length up, s")
    # Abedi, Dykaar and Afshordi quote 8 M ln M in Planck units for the same thing.
    m_planck = math.sqrt(HBAR * C / G)
    number("echo_62_abedi", 8 * G * m / C**3 * math.log(m / m_planck), 2, "8 M ln M for 62 solar masses, s")

    # A shell at 9/8 r_s is far too close to the photon sphere for late echoes.
    def tortoise(r):
        return r + rs * math.log(r / rs - 1)

    number("shell_trip_ms", 2 * (tortoise(1.5 * rs) - tortoise(9 / 8 * rs)) / C * 1e3, 2, "round trip between photon sphere and a shell at 9/8 r_s, 62 solar masses, ms")
    # Fundamental quadrupole ringing of a non-rotating hole: omega M = 0.37367 (real part).
    number("ring_period_ms", 2 * math.pi / (0.37367 * C**3 / (G * m)) * 1e3, 2, "ringdown period, 62 solar masses, ms")


def compute():
    for section in (section_bubble, section_horizon, section_vacuum, section_fabric, section_black_shell, section_hawking, section_echoes):
        section()
    return {"all_passed": all(c["ok"] for c in CHECKS), "checks": CHECKS, "numbers": NUMBERS}


def main() -> int:
    result = compute()
    if "--json" in sys.argv[1:]:
        json.dump(result, sys.stdout, ensure_ascii=False, indent=1)
        print()
    else:
        print(f"constants: l_planck = {L_PLANCK:.4e} m, M_sun = {M_SUN:.5e} kg\n")
        for key, n in NUMBERS.items():
            print(f"  {key:22s} {n['text']:>12s}   {n['what']}")
        print()
        for c in CHECKS:
            print(f"  {'ok  ' if c['ok'] else 'FAIL'}  {c['name']}" + (f"   [{c['detail']}]" if c["detail"] else ""))
        print(f"\n{sum(c['ok'] for c in CHECKS)} of {len(CHECKS)} checks passed")
    return 0 if result["all_passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
