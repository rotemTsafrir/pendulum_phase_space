# Pendulum Lab — p5.js conversion


## Features

- Fixed-timestep fourth-order Runge–Kutta (RK4), dt = 1/480 s, independent of
  display frame rate, with interpolation for smooth rendering.
- Between 1 and 200 independent pendulums, matching colors in physical and phase
  space. Click phase space to set the initial ensemble mean; drag the green reference
  bob to set the initial distribution center and release at rest.
- Wrapped Gaussian by default; Uniform rectangle available. Independent draws
  for both axes, with configurable mean and population-standard-deviation inputs.
  Both sigma controls range from 0 to 0.5 (rad and rad/s, respectively).
  Finite samples need not have exactly the requested sample moments.
- Reproducible random seed. Restart repeats initial samples; Resample increments
  the seed. Changing initial-condition controls restarts; physical parameters update live and display changes do not.
- Length, gravity, and viscous resistance.
  The pivot is fixed and the vector field is stationary.
- Stationary normalized phase-speed heatmap in purple, orange and cream,
  correctly scaled direction arrows, and continuous trajectories.
- Pause/play, single step (1/60 simulated second), simulation speed, velocity-axis
  range and trail duration. Space toggles play outside form controls.
- Responsive layout; independently scrollable desktop controls.

## Physics

Angle theta is measured from downward vertical; omega = theta_dot.

    theta_dot  = omega
    omega_dot  = -(g/L) sin(theta) - gamma omega

The dynamics have no explicit time dependence. Resistance gamma is the angular
viscous damping rate in s^-1. This replaces the old two-term resistance model;
dry/Coulomb friction is not included. If specifying a viscous torque coefficient
alpha instead, gamma = alpha/(m L^2). Mass therefore does not need a separate control.
The initial L=4 m, g=5 m/s^2 and gamma=0.03125 s^-1 match the old length, gravity
and viscous coefficient (alpha=2, m=4), excluding its dry-friction torque.

All pendulums share physical parameters. They do not interact.
The pivot remains fixed. Angles are stored unwrapped during integration; only displays wrap.
Phase-space trails break at the ±pi seam.

### Initial distributions

Wrapped Gaussian: independently draw theta from N(meanAngle, stdAngle^2) and
omega from N(meanOmega, stdOmega^2), then wrap theta to [-pi, pi). Angular sigma
is the standard deviation of the underlying unwrapped Gaussian, not a circular
standard deviation. Uniform rectangle: sample each axis within mean ± sqrt(3)
*sigma, then wrap theta. Wide rectangles can overlap themselves on the cylinder.
The standard deviations describe the populations before wrapping. Set both to
zero for identical initial conditions, or count to 1 for a single pendulum.

### Heatmap

T = sqrt(L/g). The dimensionless speed is

    s = hypot(T omega, T^2 omega_dot).

The axes retain rad and rad/s labels. Color is log(1+G*s)/log(1+G*s_max), where
s_max is a conservative time-independent upper bound over the visible omega
range. This is deliberately not recalculated from each frame's extrema. The
heatmap and color scale remain stationary while the pendulums evolve.
Changing physical parameters or the velocity-axis range changes the bound.
The displayed color bar maximum is dimensionless. Arrows are scaled in screen
coordinates, so their directions match the plotted trajectories.

### Timing and performance

At most 100 ms of wall time is accumulated per rendered frame. Longer stalls
and hidden-tab time are discarded rather than causing large catch-up bursts.
The simulation clock always reports integrated time, not total wall time. This
limit can make playback slower than real time on an overloaded device. High
counts and long trails increase rendering demands.
Rendering lags the integrated state by at most one timestep when running.
The FPS counter is a smoothed measurement of render intervals, not physics steps.
No fixed-step solver guarantees exact long-time trajectories in a chaotic regime.

## Files

- dist/index.html — page and controls
- dist/style.css — responsive interface
- dist/physics.js — p5-independent model, RK4, distributions and ring buffer
- dist/sketch.js — p5 rendering, simulation clock, interactions
- dist/energy.js — energy history and chart rendering
- dist/vendor/ — bundled p5.js and its license
- test-physics.cjs — numerical regression checks (run `node test-physics.cjs`)

## Validation

Numerical tests cover time invariance, conservative energy over 120 simulated seconds, monotonic
energy loss with damping, small-angle oscillation period, timestep convergence
at high natural frequency, distribution moments and support,
reproducibility, angle wrapping, circular buffers, and the heatmap upper bound.
Browser checks cover initial rendering, pause/step, distribution switching and parameter controls. Vendor p5.js is unmodified and retains its license.

## Advanced controls and updated defaults

The default ensemble has 15 independent samples; sigma_angle = 0.02 rad and
sigma_omega = 0.02 rad/s. Both sigma controls still range from 0 to 0.5.
The Main / Advanced tabs separate physical and initial-condition controls from
arrow density (number of columns, rows follow plot aspect ratio), maximum arrow
length in pixels, heatmap logarithm gain G, random seed, and angular-velocity
axis range. Field arrows are black. Controls and titles use lavender/slate;
the existing purple/orange/cream heatmap palette is unchanged.

The heatmap color coordinate is log(1+G*s)/log(1+G*s_max), where G > 0.
Changing these display settings does not restart the simulation; changing the
seed does. Numbered section prefixes and the three redundant footer messages
have been removed.

## Green reference pendulum

At each restart or resample, the reference is initialized from the actual random
samples: theta_ref(0) = atan2(sum(sin(theta_i(0))), sum(cos(theta_i(0)))) and
omega_ref(0) = mean(omega_i(0)). This is the finite ensemble's mean, rather than
the nominal distribution center in the controls. The reference is then evolved
independently in the very same RK4 loop and with the same 1/480-second timestep,
physical parameters and rendering interpolation as the samples. Its state is
never overwritten by subsequent ensemble averages. Green trails show its own
trajectory. As the ensemble spreads, this physical reference need not remain
at its center. The reference is additional to the configured N random samples.
If the initial circular mean resultant per sample is below 1e-8, the initial
mean angle is undefined and no reference is created; an explanatory note appears.

## Energy graph

Use the Energy graph button to open/close a chart below the simulation. Select
Kinetic, Potential, or Total energy for all N individual pendulums, using their
matching colors. Energy is per unit mass in J/kg (equivalently joules for 1 kg):

    K/m = 0.5 * L^2 * omega^2
    U/m = g * L * (1 - cos(theta))
    E/m = K/m + U/m

Potential energy is zero at the bottom. Energy curves continue to show the N
random samples; the additional green reference has no separate energy curve. The time axis
always spans t=0 through the current integrated simulation time. History is
recorded even while the chart is closed, initially at 30 Hz. At 6,000 stored
rows, every other row is retained and the sampling interval doubles, preserving
t=0 and the full run's time span with bounded memory. The live endpoint is always
included. This is uniformly coarsened sampled history, not lossless storage of
every RK4 step; sufficiently long runs may lose fine oscillatory detail. A new
run (including changed initial conditions) clears the old history. Live changes
to gravity, length and damping preserve history and record both sides of each
parameter switch. Energy jumps from changed length or gravity are expected.
Tests cover energy definitions, circular means including seam/cancellation cases,
history coarsening, retention of t=0, and history reset. Browser checks verify
opening the chart, switching energy types and Advanced controls without resetting.

Reference regression tests: `node test-reference.cjs` checks initialization at the
actual sample mean, identical RK4 evolution, long-run energy conservation,
separation from the instantaneous ensemble mean, and zero-spread coincidence.

## Live physical parameters

Gravity, length, and damping now apply immediately to all samples and the green
reference, preserving every current angle and angular velocity, time, pause/play
state, seed, trails and energy history. RK4 takes subsequent steps using the new
parameters. The field heatmap is invalidated immediately. Releasing a slider
without another value change does not repeat the parameter-switch event.
Physical trail samples retain their original lengths rather than being redrawn
at the new length. The current bob position moves to the new radius when length
changes. This models an instantaneous parameter switch at fixed (theta, omega),
not the dynamics of a continuously telescoping pendulum; energy need not be
conserved at a gravity/length switch. Energy history stores pre/post values at
the same time, showing any instantaneous jump without rewriting earlier data.
