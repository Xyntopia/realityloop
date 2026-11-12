# RealityLoop physical contact models

## Reusable static/kinetic wheel contact

`RealityLoopContacts.mo` contains:
- `LongitudinalStickSlip`: Modelica component accepting contact slip velocity, a *required no-slip reaction force* derived from coupled mass/inertia, and a normal load. Outputs signed contact traction and a discrete state: **0 sticking, +1 forward sliding, -1 backward sliding**.
- `WheelBench`: minimal wheel/body benchmark, including torque pulse and breakaway/re-sticking events.
- `TennantStickSlip`: front-steered planar drive with steering lag, wheel inertia, chassis/yaw states and the same contact component; its parameters are estimates, not Tennant specifications.

For a wheel radius `r`, wheel inertia `J`, body mass `m`, applied torque `τ`, and other external body force `F_ext`, the benchmark derives the no-slip reaction from `d(rω-v)/dt = 0`:

`F_required = (r τ / J - F_ext/m) / (r²/J + 1/m)`

When `|F_required| <= μ_static N`, the traction force is `F_required`, giving zero slip acceleration; otherwise it uses the signed kinetic limit `μ_kinetic N`. Recovery to sticking occurs as relative speed returns to zero within `1e-6 m/s`. This is a hybrid acceleration-level contact law, not a complete contact/constraint solver.

```sh
npm run sim -- scenarios/modelica-wheel-breakaway.json runs/contact
npm run sim -- scenarios/modelica-tennant-stick-slip.json runs/tennant-grip
npm test
```

Two older comparison models remain: `TennantFrontSteerSlip.mo` and `DifferentialDriveSlip.mo` use smooth regularized Coulomb traction and permit low-speed creep.

**Limitations:** 1D longitudinal contact only; no lateral/combined slip, load transfer, suspension, other-wheel friction constraints, slopes, tire relaxation or physically calibrated Tennant parameters. The separately rendered supermarket remains Rapier-driven. Future Modelica-native contact geometry uses a replaceable backend called through standard Modelica `external "C"`, not ad hoc JavaScript integration.
