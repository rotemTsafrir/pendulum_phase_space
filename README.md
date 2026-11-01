# Pendulum Lab

An interactive pendulum simulator built with p5.js. 

Explore nonlinear motion, phase-space trajectories, damping, and energy through an ensemble of independent pendulums with slightly different initial conditions.

The physical view and phase portrait show the same ensemble, making it easy to connect a pendulum’s motion with its trajectory in angle–angular-velocity space. The simulation runs entirely in the browser, with no backend or build step.

## Features

- **Physical and phase-space views** with matching instance colors and trajectory trails.
- **Phase-speed heatmap** and black arrows showing the local direction of motion.
- **Adjustable length, gravity, and damping** that take effect without restarting the simulation.
- **Ensembles of 1–200 pendulums**, sampled from a wrapped Gaussian or uniform rectangle.
- **Independent green reference pendulum**, initialized at the ensemble’s mean initial state.
- **Kinetic, potential, and total energy graphs** for every sampled pendulum, spanning the full run.
- **Fixed-timestep RK4 integration** with interpolation for smooth rendering.
- **Reproducible sampling**, pause/play, single-step, restart, and resample controls.
- **Mobile layout** with a controls drawer, touch interactions, and support for portrait and landscape resizing.

## Getting started

Download or clone the repository and open `dist/index.html` in a modern browser. Keep the files in `dist/` together. p5.js is bundled, so no installation or internet connection is required to run the downloaded simulation.

The contents of `dist/` form a static website suitable for GitHub Pages or another static host. If these files are placed directly in your repository’s root, open `index.html` instead.

## Controls

| Control | Effect |
| --- | --- |
| Play / Pause | Start or pause time evolution |
| Step | Pause and advance by 1/60 simulated second |
| Restart | Restart using the same initial settings and seed |
| Resample | Increment the seed and generate a new ensemble |
| Energy graph | Show or hide the energy chart; the button highlights while open |
| Click / tap phase space | Set the initial distribution center and restart |
| Drag the green bob | Set the initial angle distribution center and zero mean angular velocity |
| Space | Toggle play/pause outside form controls |

On mobile, use **Controls** to open the settings drawer. Swipe outside the bob to scroll the page. Resizing or rotating the screen preserves the simulation state and energy history.

**Main** contains physical parameters, initial conditions, and display controls. **Advanced** contains arrow density, maximum arrow length, logarithmic heatmap gain, random seed, and angular-velocity axis range.

Changing initial-condition settings starts a new run. Changing length, gravity, or damping preserves the current angles, angular velocities, and simulation time. Display changes do not restart the run.

## Physical model

Each pendulum is a point mass on a massless rigid rod with a fixed pivot and linear viscous damping. Pendulums do not interact.

$$
\dot{\theta}=\omega, \qquad
\dot{\omega}=-\frac{g}{L}\sin\theta-\gamma\omega
$$

Here, $\theta$ is measured from the downward vertical, $\omega$ is angular velocity, $L$ is length, $g$ is gravitational acceleration, and $\gamma$ is the damping rate in $\mathrm{s}^{-1}$.

With fixed parameters, this is an autonomous system: its vector field has no explicit time dependence. The phase portrait remains stationary while the pendulums evolve. Editing a physical parameter changes that field immediately.

Integration uses fourth-order Runge–Kutta with a fixed timestep of $1/480$ s. Angles remain unwrapped internally and are wrapped to $[-\pi,\pi)$ for the phase portrait.

### Initial conditions and reference pendulum

The default ensemble contains **15 samples**, with angle and angular-velocity standard deviations of **0.02 rad** and **0.02 rad/s**. Both spread controls range from 0 to 0.5.

- **Wrapped Gaussian:** sample angle and angular velocity independently from normal distributions, then wrap the angle. Angular spread refers to the underlying unwrapped Gaussian.
- **Uniform rectangle:** sample each coordinate independently within its mean plus or minus $\sqrt{3}\sigma$, then wrap the angle. This gives the same specified standard deviation before wrapping.

Finite samples need not have exactly the requested population mean or spread.

The green reference starts at the samples’ circular mean angle and arithmetic mean angular velocity. It then evolves independently using the same RK4 solver. It is **not the ensemble’s instantaneous mean**, so it can move away from the ensemble’s center over time. It is additional to the configured sample count.

### Heatmap

The heatmap represents dimensionless phase-space speed, combining angular velocity and angular acceleration:

$$
T=\sqrt{L/g}, \qquad
s=\sqrt{(T\omega)^2+(T^2\dot{\omega})^2}
$$

Color uses a logarithmic mapping, $\log(1+Gs)/\log(1+Gs_{\max})$, where $G$ is the adjustable gain and $s_{\max}$ is a fixed upper bound for the current parameters and visible angular-velocity range. Colors do not rescale according to the moving ensemble. This is a speed map, not a probability-density map.

### Energy

Energy is shown per unit mass, in J/kg, with potential energy zero at the bottom:

$$
K/m=\tfrac12 L^2\omega^2, \qquad U/m=gL(1-\cos\theta), \qquad E/m=K/m+U/m
$$

For fixed parameters, $\dot E/m=-\gamma L^2\omega^2$. Energy is conserved in the undamped model and decreases with positive damping, up to numerical error.

The chart includes all sampled pendulums; the additional reference has no separate energy curve. History is recorded even while the chart is closed. Long runs progressively reduce the sampling density while retaining the full time span from zero.

Live changes to length or gravity can produce energy jumps. These edits switch parameters at fixed angle and angular velocity; they do not model the mechanics of continuously changing a rod’s length.

## Things to explore

- Set damping to zero and compare libration with full rotations.
- Start near the upright unstable equilibrium and watch nearby initial conditions separate.
- Increase the initial spread and observe how the ensemble stretches in phase space.
- Add damping and watch trajectories approach the stable equilibrium.
- Compare kinetic and potential energy exchange with the total energy curve.

The fixed-parameter single-pendulum model is not chaotic; separation near an unstable equilibrium alone is not evidence of chaos.

## Project files

| File | Purpose |
| --- | --- |
| `dist/index.html` | Page structure and controls |
| `dist/style.css` | Styling and responsive layout |
| `dist/physics.js` | Equations, RK4 integration, sampling, and trail buffers |
| `dist/sketch.js` | p5.js rendering and simulation interactions |
| `dist/energy.js` | Energy history and chart rendering |
| `dist/mobile-ui.js` | Mobile controls drawer and keyboard handling |
| `dist/vendor/` | Bundled p5.js and its license |

## Validation and limitations

Run the regression checks with Node.js from the repository root:

```sh
node test-physics.cjs
node test-reference.cjs
node test-live-parameters.cjs
```

Checks cover numerical integration, distributions, reference evolution, and preservation of state during live parameter changes.

RK4 is accurate at the chosen timestep but is not an exactly energy-conserving integrator. Very long runs may accumulate numerical error. High instance counts and long trails increase rendering cost. Large frame delays are capped, so simulated time can advance more slowly than wall time on overloaded devices.

Browser checks cover mobile-sized layouts and orientation-style resizing. Actual device performance and touch behavior can vary.

## Credits

Built with [p5.js](https://p5js.org/). The bundled library retains its license in `dist/vendor/p5-LICENSE.txt`.
