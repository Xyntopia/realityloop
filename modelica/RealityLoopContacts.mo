// Portable 1D Coulomb rolling contact, standalone Modelica.
// Static contact is enforced by an acceleration-level force balance;
// sliding uses signed kinetic friction. No Rapier or external library.
package RealityLoopContacts
  model LongitudinalStickSlip
    parameter Real muStatic = 0.8 "Maximum static friction coefficient";
    parameter Real muKinetic = 0.6 "Sliding friction coefficient";
    parameter Real slipTolerance = 1e-6 "Velocity tolerance at the stick transition [m/s]";
    input Real demandedTraction "Force required to enforce rolling without slip [N]";
    input Real slipSpeed "Wheel rim speed minus vehicle contact speed [m/s]";
    input Real normalLoad "Positive contact normal force [N]";
    output Real traction "Force exerted on chassis [N]";
    discrete Integer mode(start=0,fixed=true) "0 sticking, +1 forward sliding, -1 reverse sliding";
  equation
    traction = if mode == 0 then demandedTraction
      else if mode == 1 then muKinetic*normalLoad else -muKinetic*normalLoad;

    when initial() then
      mode = if demandedTraction > muStatic*normalLoad then 1
        else if demandedTraction < -muStatic*normalLoad then -1 else 0;
    elsewhen pre(mode) == 0 and demandedTraction > muStatic*normalLoad then
      mode = 1;
    elsewhen pre(mode) == 0 and demandedTraction < -muStatic*normalLoad then
      mode = -1;
    elsewhen pre(mode) > 0 and slipSpeed <= slipTolerance then
      mode = if demandedTraction < -muStatic*normalLoad then -1
        else if demandedTraction <= muStatic*normalLoad then 0 else 1;
    elsewhen pre(mode) < 0 and slipSpeed >= -slipTolerance then
      mode = if demandedTraction > muStatic*normalLoad then 1
        else if demandedTraction >= -muStatic*normalLoad then 0 else -1;
    end when;
  end LongitudinalStickSlip;

  model TennantStickSlip
    // Front-steered, driven wheel with discrete stick/slip contact.
    // Chassis + axle estimates are not manufacturer-validated T7AMR parameters.
    parameter Real bodyMass=479 "Reference body mass [kg]";
    parameter Real yawInertia=190 "Estimated yaw inertia [kg.m2]";
    parameter Real wheelRadius=0.165 "Estimated driven wheel radius [m]";
    parameter Real wheelInertia=1.7 "Estimated driven wheel inertia [kg.m2]";
    parameter Real frontWheelX=0.54 "Estimated front-wheel offset [m]";
    parameter Real frontLoadFraction=0.58 "Estimated front axle load share";
    parameter Real muStatic=0.72 "Maximum static tire/floor friction";
    parameter Real muKinetic=0.75*muStatic "Sliding friction is below static friction";
    parameter Real motorTorque=50 "Applied wheel motor torque [N.m]";
    parameter Real torqueOffTime=1.2 "End of torque pulse [s]";
    parameter Real targetSteer=0.2 "Steering angle setpoint [rad]";
    parameter Real steerTimeConstant=0.17 "Steering actuator time constant [s]";
    parameter Real viscousBody=0.3 "Body drag coefficient [1/s]";
    parameter Real viscousYaw=0.4 "Yaw drag coefficient [1/s]";
    parameter Real viscousWheel=1.9 "Wheel angular drag [N.m.s/rad]";
    Real x(start=0,fixed=true);
    Real z(start=0,fixed=true);
    Real yaw(start=0,fixed=true);
    Real v(start=0,fixed=true);
    Real yawRate(start=0,fixed=true);
    Real wheelOmega(start=0,fixed=true);
    Real steer(start=0,fixed=true);
    Real appliedTorque;
    Real slipSpeed;
    Real demandedTraction;
    Real traction;
    Integer contactMode;
    Real frontNormal;
    Real bodyDrag;
    Real yawDrag;
    Real steerRate;
    LongitudinalStickSlip contact(muStatic=muStatic,muKinetic=muKinetic);
  equation
    frontNormal=bodyMass*9.81*frontLoadFraction;
    appliedTorque=if time < torqueOffTime then motorTorque else 0;
    steerRate=(targetSteer-steer)/steerTimeConstant;
    der(steer)=steerRate;
    bodyDrag=-viscousBody*bodyMass*v;
    yawDrag=-viscousYaw*yawInertia*yawRate;
    slipSpeed=wheelRadius*wheelOmega-v*cos(steer)-frontWheelX*yawRate*sin(steer);
    demandedTraction=(
      wheelRadius*(appliedTorque-viscousWheel*wheelOmega)/wheelInertia
      -cos(steer)*bodyDrag/bodyMass
      -frontWheelX*sin(steer)*yawDrag/yawInertia
      +(v*sin(steer)-frontWheelX*yawRate*cos(steer))*steerRate
    )/(wheelRadius*wheelRadius/wheelInertia
       +cos(steer)*cos(steer)/bodyMass
       +frontWheelX*frontWheelX*sin(steer)*sin(steer)/yawInertia);
    contact.demandedTraction=demandedTraction;
    contact.slipSpeed=slipSpeed;
    contact.normalLoad=frontNormal;
    traction=contact.traction;
    contactMode=contact.mode;
    wheelInertia*der(wheelOmega)=appliedTorque-wheelRadius*traction-viscousWheel*wheelOmega;
    bodyMass*der(v)=traction*cos(steer)+bodyDrag;
    yawInertia*der(yawRate)=frontWheelX*traction*sin(steer)+yawDrag;
    der(yaw)=yawRate;
    der(x)=v*cos(yaw);
    der(z)=-v*sin(yaw);
    annotation(experiment(StartTime=0,StopTime=3,Interval=0.02,Tolerance=1e-7));
  end TennantStickSlip;

  model WheelBench
    parameter Real bodyMass = 100 "Chassis mass [kg]";
    parameter Real wheelInertia = 0.75 "Wheel inertia [kg.m2]";
    parameter Real wheelRadius = 0.17 "Wheel radius [m]";
    parameter Real muStatic = 0.72;
    parameter Real muKinetic = 0.75*muStatic;
    parameter Real normalLoad = 400 "Normal load [N]";
    parameter Real driveTorque = 20 "Applied motor torque [N.m]";
    parameter Real torqueOffTime = 0.65 "Motor-off event time [s]";
    parameter Real bodyDrag = 0 "External chassis force [N]";
    Real x(start=0,fixed=true);
    Real v(start=0,fixed=true);
    Real wheelOmega(start=0,fixed=true);
    Real appliedTorque;
    Real slipSpeed;
    Real demandedTraction;
    Real traction;
    Integer contactMode;
    LongitudinalStickSlip contact(muStatic=muStatic,muKinetic=muKinetic);
  equation
    appliedTorque = if time < torqueOffTime then driveTorque else 0;
    slipSpeed = wheelRadius*wheelOmega-v;
    demandedTraction = (wheelRadius*appliedTorque/wheelInertia-bodyDrag/bodyMass) /
      (wheelRadius*wheelRadius/wheelInertia+1/bodyMass);
    contact.demandedTraction=demandedTraction;
    contact.slipSpeed=slipSpeed;
    contact.normalLoad=normalLoad;
    traction=contact.traction;
    contactMode=contact.mode;
    bodyMass*der(v)=traction+bodyDrag;
    wheelInertia*der(wheelOmega)=appliedTorque-wheelRadius*traction;
    der(x)=v;
    annotation(experiment(StartTime=0,StopTime=2,Interval=0.01,Tolerance=1e-7));
  end WheelBench;

  model SupermarketRobot
    // A small, fully Modelica-driven PLANAR contact/traction test scene.
    // Rounded chassis contact against one fixed shelf blockage.
    // All physical state evolves in Rumoca. No Rapier callbacks or timesteps.
    parameter Real detourRoute = 1 "1 = detour waypoints, 0 = blocked direct route";
    parameter Real bodyMass = 479 "Reference mass [kg]";
    parameter Real yawInertia = 190 "Estimated yaw inertia [kg.m2]";
    parameter Real wheelRadius = 0.165;
    parameter Real wheelInertia = 1.7;
    parameter Real frontWheelX = 0.54;
    parameter Real frontLoadFraction = 0.58;
    parameter Real muStatic = 0.72;
    parameter Real muKinetic = 0.75*muStatic;
    parameter Real motorLimit = 135 "Wheel motor torque cap [N.m]";
    parameter Real maximumSpeed = 1.0 "Requested maximum speed [m/s]";
    parameter Real steeringGain = 1.0 "Heading to steering gain";
    parameter Real yawFeedback = 1.25 "Yaw-rate stabilizing feedback";
    parameter Real waypointRadius = 0.64 "Waypoint capture radius [m]";
    parameter Real obstacleCenterX = 4.35;
    parameter Real obstacleHalfX = 0.45;
    parameter Real obstacleHalfZ = 1.27;
    parameter Real contactRadius = 0.44 "Conservative circular robot contact approximation";
    parameter Real collisionStiffness = 14000 "Normal penetration stiffness [N/m]";
    parameter Real collisionDamping = 2100 "Normal approach damping [N.s/m]";
    Real x(start = 0, fixed = true);
    Real z(start = 0, fixed = true);
    Real yaw(start = 0, fixed = true);
    Real v(start = 0, fixed = true);
    Real yawRate(start = 0, fixed = true);
    Real wheelOmega(start = 0, fixed = true);
    Real steer(start = 0, fixed = true);
    discrete Integer waypoint(start = 1, fixed = true);
    Real targetX;
    Real targetZ;
    Real distanceToWaypoint;
    Real headingError;
    Real targetSteer;
    Real steerRate;
    Real speedTarget;
    Real appliedTorque;
    Real demandedTraction;
    Real slipSpeed;
    Real traction;
    Integer contactMode;
    Real frontNormal;
    Real bodyDrag;
    Real yawDrag;
    Real outX;
    Real outZ;
    Real outerDistance;
    Real normalX;
    Real normalZ;
    Real collisionDepth;
    Real approachSpeed;
    Real collisionForce;
    Real collisionLongitudinal;
    Real contactLoad;
    LongitudinalStickSlip contact(muStatic = muStatic, muKinetic = muKinetic);
  equation
    targetX = if detourRoute < 0.5 then 7.5
      else if waypoint == 1 then 2.3
      else if waypoint == 2 then 5.9 else 7.5;
    targetZ = if detourRoute < 0.5 then 0
      else if waypoint == 1 then 2.1
      else if waypoint == 2 then 2.1 else 0;
    distanceToWaypoint = sqrt((targetX - x)^2 + (targetZ - z)^2);
    headingError = atan2(sin(atan2(-(targetZ - z), targetX - x) - yaw),
      cos(atan2(-(targetZ - z), targetX - x) - yaw));
    targetSteer = max(-0.78, min(0.78, steeringGain*headingError - yawFeedback*yawRate));
    steerRate = (targetSteer - steer)/0.17;
    der(steer) = steerRate;
    speedTarget = maximumSpeed*min(1, distanceToWaypoint/0.9)*
      max(0.26, 1 - abs(headingError)/2.8);
    appliedTorque = max(-motorLimit,
      min(motorLimit, 140*(speedTarget/wheelRadius - wheelOmega)));

    // Main aisle blockage: nearest-point sphere/expanded-rectangle contact.
    outX = max(abs(x-obstacleCenterX)-obstacleHalfX, 0);
    outZ = max(abs(z)-obstacleHalfZ, 0);
    outerDistance = sqrt(outX^2+outZ^2);
    normalX = if outerDistance > 1e-9 then
      (if x > obstacleCenterX then outX else -outX)/outerDistance
      else if x < obstacleCenterX then -1 else 1;
    normalZ = if outerDistance > 1e-9 then
      (if z > 0 then outZ else -outZ)/outerDistance else 0;
    collisionDepth = max(0, contactRadius - outerDistance);
    approachSpeed = v*(cos(yaw)*normalX - sin(yaw)*normalZ);
    collisionForce = if collisionDepth > 0 then
      collisionStiffness*collisionDepth +
        collisionDamping*max(0, -approachSpeed) else 0;
    collisionLongitudinal = collisionForce*
      (cos(yaw)*normalX - sin(yaw)*normalZ);
    contactLoad = collisionForce;

    frontNormal = bodyMass*9.81*frontLoadFraction;
    bodyDrag = -0.3*bodyMass*v + collisionLongitudinal;
    yawDrag = -0.4*yawInertia*yawRate;
    slipSpeed = wheelRadius*wheelOmega - v*cos(steer) -
      frontWheelX*yawRate*sin(steer);
    demandedTraction = (
      wheelRadius*(appliedTorque - 1.9*wheelOmega)/wheelInertia
      - cos(steer)*bodyDrag/bodyMass
      - frontWheelX*sin(steer)*yawDrag/yawInertia
      + (v*sin(steer) - frontWheelX*yawRate*cos(steer))*steerRate
    )/(wheelRadius^2/wheelInertia + cos(steer)^2/bodyMass +
      frontWheelX^2*sin(steer)^2/yawInertia);
    contact.demandedTraction = demandedTraction;
    contact.slipSpeed = slipSpeed;
    contact.normalLoad = frontNormal;
    traction = contact.traction;
    contactMode = contact.mode;

    wheelInertia*der(wheelOmega) = appliedTorque - wheelRadius*traction -
      1.9*wheelOmega;
    bodyMass*der(v) = traction*cos(steer) + bodyDrag;
    yawInertia*der(yawRate) = frontWheelX*traction*sin(steer) + yawDrag;
    der(yaw) = yawRate;
    der(x) = v*cos(yaw);
    der(z) = -v*sin(yaw);

    when detourRoute > 0.5 and pre(waypoint) == 1 and
      distanceToWaypoint < waypointRadius then
      waypoint = 2;
    elsewhen detourRoute > 0.5 and pre(waypoint) == 2 and
      distanceToWaypoint < waypointRadius then
      waypoint = 3;
    end when;

    annotation(experiment(StartTime=0, StopTime=20, Interval=0.05,
      Tolerance=1e-6));
  end SupermarketRobot;

  model SupermarketBlocked
    extends SupermarketRobot(detourRoute=0);
  end SupermarketBlocked;
end RealityLoopContacts;
