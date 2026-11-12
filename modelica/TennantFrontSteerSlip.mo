// Reference-inspired T7AMR FRONT STEER DRIVE concept; no manufacturer drive calibration.
// Intended for Rumoca after external-library and physics integration is available.
// One driven/steered front wheel, two passive rear support wheels.
// Planar body longitudinal and yaw dynamics with regularized friction.
model TennantFrontSteerSlip
  parameter Real m = 479 "Reference mass with battery [kg]";
  parameter Real Iz = 190 "Estimated yaw inertia [kg.m2]";
  parameter Real wheelRadius = 0.165 "Estimated front drive wheel radius [m]";
  parameter Real wheelInertia = 1.7 "Estimated driven-wheel inertia [kg.m2]";
  parameter Real frontWheelX = 0.54 "Estimated front wheel offset from CM [m]";
  parameter Real mu = 0.72 "Assumed tire/floor coefficient";
  parameter Real normalFrontFraction = 0.58 "Assumed load on front wheel";
  parameter Real slipSmoothing = 0.22 "Regularization [m/s]";
  parameter Real steeringTimeConstant = 0.17 "Estimated steer response [s]";
  parameter Real motorTorque = 50 "Example wheel-drive torque [N.m]";
  parameter Real targetSteer = 0.2 "Example steer angle [rad]";
  Real x(start=0,fixed=true);
  Real z(start=0,fixed=true);
  Real yaw(start=0,fixed=true);
  Real v(start=0,fixed=true);
  Real yawRate(start=0,fixed=true);
  Real omegaDrive(start=0,fixed=true);
  Real steer(start=0,fixed=true);
  Real normalFront;
  Real wheelSlip;
  Real driveForce;
equation
  normalFront=m*9.81*normalFrontFraction;
  der(steer)=(targetSteer-steer)/steeringTimeConstant;
  wheelSlip=wheelRadius*omegaDrive-v*cos(steer);
  driveForce=mu*normalFront*tanh(wheelSlip/slipSmoothing);
  wheelInertia*der(omegaDrive)=motorTorque-wheelRadius*driveForce-1.9*omegaDrive;
  m*der(v)=driveForce*cos(steer)-0.3*m*v;
  Iz*der(yawRate)=frontWheelX*driveForce*sin(steer)-0.4*Iz*yawRate;
  der(yaw)=yawRate;
  der(x)=v*cos(yaw);
  der(z)=-v*sin(yaw);
  annotation(experiment(StartTime=0,StopTime=5,Interval=0.005,Tolerance=1e-6));
end TennantFrontSteerSlip;
