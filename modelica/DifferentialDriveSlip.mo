// Standalone explanatory traction plant. Intended as the physics-authoritative
// replacement for realityloop/src/cleaning.ts when the Rumoca external-library
// and Modelica simulation boundary is implemented.
// Coordinates: positive yaw turns the robot's +x direction toward -z.
model DifferentialDriveSlip
  parameter Real m = 55 "Vehicle mass [kg]";
  parameter Real Iz = 5 "Chassis yaw inertia [kg.m2]";
  parameter Real wheelInertia = 0.06 "Wheel inertia [kg.m2]";
  parameter Real wheelRadius = 0.12 "Wheel radius [m]";
  parameter Real halfTrack = 0.28 "Half wheel separation [m]";
  parameter Real mu = 0.72 "Longitudinal traction coefficient";
  parameter Real slipSmoothing = 0.15 "Slip regularization [m/s]";
  parameter Real wheelDrag = 0.025 "Wheel viscous drag [N.m.s/rad]";
  parameter Real torqueLeft = 4 "Left motor torque [N.m]";
  parameter Real torqueRight = 4 "Right motor torque [N.m]";

  Real x(start = 0, fixed = true);
  Real z(start = 0, fixed = true);
  Real yaw(start = 0, fixed = true);
  Real v(start = 0, fixed = true);
  Real yawRate(start = 0, fixed = true);
  Real omegaL(start = 0, fixed = true);
  Real omegaR(start = 0, fixed = true);
  Real slipL;
  Real slipR;
  Real normalPerWheel;
  Real tractionL;
  Real tractionR;

equation
  normalPerWheel = m * 9.81 / 2;
  slipL = wheelRadius * omegaL - (v + halfTrack * yawRate);
  slipR = wheelRadius * omegaR - (v - halfTrack * yawRate);
  tractionL = mu * normalPerWheel * tanh(slipL / slipSmoothing);
  tractionR = mu * normalPerWheel * tanh(slipR / slipSmoothing);

  wheelInertia * der(omegaL) = torqueLeft - wheelRadius * tractionL - wheelDrag * omegaL;
  wheelInertia * der(omegaR) = torqueRight - wheelRadius * tractionR - wheelDrag * omegaR;
  m * der(v) = tractionL + tractionR;
  Iz * der(yawRate) = halfTrack * (tractionL - tractionR);
  der(x) = v * cos(yaw);
  der(z) = -v * sin(yaw);
  der(yaw) = yawRate;

  annotation(experiment(StartTime = 0, StopTime = 3, Interval = 0.01, Tolerance = 1e-6));
end DifferentialDriveSlip;
