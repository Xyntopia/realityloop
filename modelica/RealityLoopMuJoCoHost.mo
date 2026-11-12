package RealityLoopMuJoCoHost
  // Proof of a *synchronous Modelica-originated* external "C" call.
  // The first Rumoca WASM bridge accepts a strictly admitted scalar
  // C ABI: three scalar Real inputs and one Real output argument.
  // official MuJoCo WASM mj_kinematics + mj_collision. No mj_step.
  //
  // This is not yet an arbitrary C linker or ExternalObject lifecycle.
  pure function penetration
    input Real x "World X";
    input Real z "World lateral Z";
    input Real yaw "World heading";
    output Real depth "Maximum overlapping contact depth [m]";
    external "C" RumocaHost_externalReal3(x, z, yaw, depth);
  end penetration;

  model CollisionProbe
    // Starts outside the central aisle blocker and drives into it.
    // Unlike an externally observed JS collision check, depth is a
    // variable inside this compiled Modelica DAE and affects der(x).
    Real x(start=3.4, fixed=true);
    Real z(start=0, fixed=true);
    Real yaw(start=0, fixed=true);
    Real depth;
  equation
    der(z)=0;
    der(yaw)=0;
    depth=penetration(x,z,yaw);
    der(x)=0.45-0.6*depth;
    annotation(experiment(StartTime=0, StopTime=2.0, Interval=0.05));
  end CollisionProbe;
end RealityLoopMuJoCoHost;
