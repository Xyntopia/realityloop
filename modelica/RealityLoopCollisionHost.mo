package RealityLoopCollisionHost
  // Backend-neutral, limited Rumoca host ABI probe. The pure Modelica
  // supermarket remains the default; selecting this requires an explicit,
  // patched Rumoca real3 callback runtime. No foreign physics time stepping.
  pure function contactDepth
    input Real x "World X [m]";
    input Real z "World lateral Z [m]";
    input Real yaw "Heading [rad]";
    output Real depth "Contact penetration [m]";
    external "C" RumocaHost_externalReal3(x,z,yaw,depth);
  end contactDepth;

  model CollisionProbe
    Real x(start=3.4,fixed=true);
    Real z(start=0,fixed=true);
    Real yaw(start=0,fixed=true);
    Real depth;
  equation
    der(z)=0;
    der(yaw)=0;
    depth=contactDepth(x,z,yaw);
    // Contact query changes a Modelica-owned physical differential equation.
    der(x)=0.45-0.6*depth;
    annotation(experiment(StartTime=0,StopTime=2,Interval=0.05));
  end CollisionProbe;
end RealityLoopCollisionHost;
