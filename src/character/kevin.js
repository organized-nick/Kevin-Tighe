/**
 * src/character/kevin.js
 * Kevin Tighe: 3D Lakeside Retreat - Articulated 3D Procedural Avatar Rig & Kinematics
 *
 * Implements Kevin Tighe in signature attire:
 * - Orange tunic (0xff6b1a, MeshPhysicalMaterial with clearcoat & normal map)
 * - Burnt-orange tights/pants (0xc2410c)
 * - High-top orange sneakers (0xff3b00) with white rubber soles
 * - White-gloved hands with thumbs and articulated shoulder joints
 * - Peter Pan cap (0x15803d) with 3 swept-back quills and radiant golden quill feather (0xfacc15)
 * - Articulated procedural rig with idle breathing, walking/running arm & leg swings,
 *   airborne jump posture, Peter Pan hero flight tilt, and signature chin-stroking "Hmm..." pose
 */

import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class KevinAvatar {
  constructor(scene, textureManager = null) {
    this.scene = scene;
    this.textures = textureManager;

    this.group = new THREE.Group();
    this.group.name = 'KevinTigheAvatar';

    this.animTime = 0;
    this.ponderPose = 0; // 0 = normal, 1 = chin stroke
    this.flightPose = 0; // 0 = upright, 1 = horizontal hero flight

    this.initMaterials();
    this.initRig();

    if (this.scene) {
      this.scene.add(this.group);
    }
  }

  initMaterials() {
    // Normal map for citrus peel tunic texture if textureManager available
    const citrusNormal = this.textures ? this.textures.get('citrus_peel_normal', 2, 2) : null;

    // 1. Signature Orange Tunic (MeshPhysicalMaterial with citrus peel clearcoat)
    this.matTunic = new THREE.MeshPhysicalMaterial({
      color: CONFIG.COLORS.ORANGE_PRIMARY || 0xff6b1a,
      roughness: 0.38,
      metalness: 0.05,
      clearcoat: 0.35,
      clearcoatRoughness: 0.2,
      normalMap: citrusNormal
    });

    // 2. Burnt-Orange Tights / Pants
    this.matTights = new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.ORANGE_DARK || 0xc2410c,
      roughness: 0.65,
      metalness: 0.05
    });

    // 3. High-Top Sneakers
    this.matSneakers = new THREE.MeshPhysicalMaterial({
      color: 0xff3b00,
      roughness: 0.28,
      clearcoat: 0.75
    });

    // Sneaker Sole (White)
    this.matSneakerSole = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.4
    });

    // 4. White Gloved Hands
    this.matGlove = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.38
    });

    // 5. Skin Tone
    this.matSkin = new THREE.MeshStandardMaterial({
      color: 0xfed7aa,
      roughness: 0.55
    });

    // 6. Peter Pan Cap (Swept-back cones)
    this.matCap = new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.PETER_PAN_GREEN || 0x15803d,
      roughness: 0.52
    });

    // 7. Cap Trim & Belt (Dark Green / Brown)
    this.matBelt = new THREE.MeshStandardMaterial({
      color: 0x451a03,
      roughness: 0.7
    });

    // 8. Golden Quill Feather
    this.matFeather = new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.FEATHER_GOLD || 0xfacc15,
      metalness: 0.35,
      roughness: 0.25,
      emissive: 0xfacc15,
      emissiveIntensity: 0.2
    });

    // 9. Facial Features (Eyes & Pupils)
    this.matEye = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.1 });
    this.matEyeWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.0 });
  }

  initRig() {
    this.bodyRig = new THREE.Group();
    this.bodyRig.name = 'BodyRig';
    this.group.add(this.bodyRig);

    // =======================================================================
    // 1. Torso & Tunic
    // =======================================================================
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.y = 1.15;
    this.bodyRig.add(this.torsoGroup);

    // Conical flared tunic skirt
    const tunicGeo = new THREE.ConeGeometry(0.52, 1.05, 16);
    this.tunicMesh = new THREE.Mesh(tunicGeo, this.matTunic);
    this.tunicMesh.position.y = 0.15;
    this.tunicMesh.castShadow = true;
    this.tunicMesh.receiveShadow = true;
    this.torsoGroup.add(this.tunicMesh);

    // Upper chest cylinder
    const chestGeo = new THREE.CylinderGeometry(0.38, 0.46, 0.65, 16);
    const chestMesh = new THREE.Mesh(chestGeo, this.matTunic);
    chestMesh.position.y = 0.35;
    chestMesh.castShadow = true;
    this.torsoGroup.add(chestMesh);

    // Belt & Golden Buckle
    const beltGeo = new THREE.CylinderGeometry(0.48, 0.50, 0.12, 16);
    const beltMesh = new THREE.Mesh(beltGeo, this.matBelt);
    beltMesh.position.y = -0.15;
    this.torsoGroup.add(beltMesh);

    const buckleGeo = new THREE.BoxGeometry(0.18, 0.16, 0.08);
    const buckleMesh = new THREE.Mesh(buckleGeo, this.matFeather);
    buckleMesh.position.set(0, -0.15, 0.50);
    this.torsoGroup.add(buckleMesh);

    // =======================================================================
    // 2. Head & Peter Pan Feathered Cap
    // =======================================================================
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.95, 0);
    this.bodyRig.add(this.headGroup);

    // Head Sphere
    const headGeo = new THREE.SphereGeometry(0.38, 20, 20);
    this.headMesh = new THREE.Mesh(headGeo, this.matSkin);
    this.headMesh.castShadow = true;
    this.headGroup.add(this.headMesh);

    // Nose
    const noseGeo = new THREE.ConeGeometry(0.07, 0.18, 8);
    const noseMesh = new THREE.Mesh(noseGeo, this.matSkin);
    noseMesh.rotation.x = Math.PI / 2;
    noseMesh.position.set(0, 0, 0.40);
    this.headGroup.add(noseMesh);

    // Eyes (White Sclera + Dark Pupils)
    const eyeWhiteGeo = new THREE.SphereGeometry(0.10, 12, 12);
    const eyePupilGeo = new THREE.SphereGeometry(0.05, 12, 12);

    // Left Eye
    const eyeWhiteL = new THREE.Mesh(eyeWhiteGeo, this.matEyeWhite);
    eyeWhiteL.position.set(-0.14, 0.06, 0.32);
    eyeWhiteL.scale.set(1, 1, 0.4);
    const eyePupilL = new THREE.Mesh(eyePupilGeo, this.matEye);
    eyePupilL.position.set(-0.14, 0.06, 0.36);
    this.headGroup.add(eyeWhiteL, eyePupilL);

    // Right Eye
    const eyeWhiteR = new THREE.Mesh(eyeWhiteGeo, this.matEyeWhite);
    eyeWhiteR.position.set(0.14, 0.06, 0.32);
    eyeWhiteR.scale.set(1, 1, 0.4);
    const eyePupilR = new THREE.Mesh(eyePupilGeo, this.matEye);
    eyePupilR.position.set(0.14, 0.06, 0.36);
    this.headGroup.add(eyeWhiteR, eyePupilR);

    // Cap Group
    this.capGroup = new THREE.Group();
    this.capGroup.position.set(0, 0.22, -0.05);
    this.headGroup.add(this.capGroup);

    // Cap Brim
    const brimGeo = new THREE.CylinderGeometry(0.42, 0.44, 0.12, 16);
    const brimMesh = new THREE.Mesh(brimGeo, this.matCap);
    brimMesh.rotation.x = -0.15;
    this.capGroup.add(brimMesh);

    // Swept-back cap quills
    for (let q = 0; q < 3; q++) {
      const quillGeo = new THREE.ConeGeometry(0.24 - q * 0.04, 0.95, 12);
      const quill = new THREE.Mesh(quillGeo, this.matCap);
      quill.rotation.x = -Math.PI * 0.42 - q * 0.12;
      quill.position.set(0, -0.05 + q * 0.08, -0.28 - q * 0.14);
      quill.castShadow = true;
      this.capGroup.add(quill);
    }

    // Peter Pan Golden Quill Feather
    const featherGeo = new THREE.ConeGeometry(0.09, 0.82, 10);
    this.featherMesh = new THREE.Mesh(featherGeo, this.matFeather);
    this.featherMesh.rotation.z = Math.PI * 0.28;
    this.featherMesh.rotation.x = -Math.PI * 0.35;
    this.featherMesh.position.set(-0.35, 0.28, -0.12);
    this.featherMesh.castShadow = true;
    this.capGroup.add(this.featherMesh);

    // =======================================================================
    // 3. Arms & White Gloved Hands (Articulated Shoulder Pivots)
    // =======================================================================
    const armGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.58, 10);
    const gloveGeo = new THREE.SphereGeometry(0.16, 14, 14);
    const thumbGeo = new THREE.SphereGeometry(0.07, 10, 10);

    // Left Arm Pivot
    this.leftShoulder = new THREE.Group();
    this.leftShoulder.position.set(-0.46, 1.70, 0);
    this.bodyRig.add(this.leftShoulder);

    const leftArmMesh = new THREE.Mesh(armGeo, this.matTunic);
    leftArmMesh.position.y = -0.28;
    leftArmMesh.castShadow = true;
    this.leftShoulder.add(leftArmMesh);

    this.leftHand = new THREE.Mesh(gloveGeo, this.matGlove);
    this.leftHand.position.y = -0.62;
    this.leftHand.castShadow = true;
    const thumbL = new THREE.Mesh(thumbGeo, this.matGlove);
    thumbL.position.set(0.12, 0.04, 0.05);
    this.leftHand.add(thumbL);
    this.leftShoulder.add(this.leftHand);

    // Right Arm Pivot
    this.rightShoulder = new THREE.Group();
    this.rightShoulder.position.set(0.46, 1.70, 0);
    this.bodyRig.add(this.rightShoulder);

    const rightArmMesh = new THREE.Mesh(armGeo, this.matTunic);
    rightArmMesh.position.y = -0.28;
    rightArmMesh.castShadow = true;
    this.rightShoulder.add(rightArmMesh);

    this.rightHand = new THREE.Mesh(gloveGeo, this.matGlove);
    this.rightHand.position.y = -0.62;
    this.rightHand.castShadow = true;
    const thumbR = new THREE.Mesh(thumbGeo, this.matGlove);
    thumbR.position.set(-0.12, 0.04, 0.05);
    this.rightHand.add(thumbR);
    this.rightShoulder.add(this.rightHand);

    // =======================================================================
    // 4. Legs & Orange Hi-Top Sneakers (Articulated Hip Pivots)
    // =======================================================================
    const legGeo = new THREE.CylinderGeometry(0.13, 0.10, 0.62, 12);
    const shoeBoxGeo = new THREE.BoxGeometry(0.26, 0.20, 0.48);
    const shoeSoleGeo = new THREE.BoxGeometry(0.28, 0.06, 0.50);

    // Left Leg Pivot
    this.leftHip = new THREE.Group();
    this.leftHip.position.set(-0.20, 0.72, 0);
    this.bodyRig.add(this.leftHip);

    const leftLegMesh = new THREE.Mesh(legGeo, this.matTights);
    leftLegMesh.position.y = -0.30;
    leftLegMesh.castShadow = true;
    this.leftHip.add(leftLegMesh);

    this.leftShoeGroup = new THREE.Group();
    this.leftShoeGroup.position.set(0, -0.62, 0.08);
    const shoeUpperL = new THREE.Mesh(shoeBoxGeo, this.matSneakers);
    shoeUpperL.position.y = 0.08;
    shoeUpperL.castShadow = true;
    const shoeSoleL = new THREE.Mesh(shoeSoleGeo, this.matSneakerSole);
    shoeSoleL.position.y = -0.03;
    shoeSoleL.receiveShadow = true;
    this.leftShoeGroup.add(shoeUpperL, shoeSoleL);
    this.leftHip.add(this.leftShoeGroup);

    // Right Leg Pivot
    this.rightHip = new THREE.Group();
    this.rightHip.position.set(0.20, 0.72, 0);
    this.bodyRig.add(this.rightHip);

    const rightLegMesh = new THREE.Mesh(legGeo, this.matTights);
    rightLegMesh.position.y = -0.30;
    rightLegMesh.castShadow = true;
    this.rightHip.add(rightLegMesh);

    this.rightShoeGroup = new THREE.Group();
    this.rightShoeGroup.position.set(0, -0.62, 0.08);
    const shoeUpperR = new THREE.Mesh(shoeBoxGeo, this.matSneakers);
    shoeUpperR.position.y = 0.08;
    shoeUpperR.castShadow = true;
    const shoeSoleR = new THREE.Mesh(shoeSoleGeo, this.matSneakerSole);
    shoeSoleR.position.y = -0.03;
    shoeSoleR.receiveShadow = true;
    this.rightShoeGroup.add(shoeUpperR, shoeSoleR);
    this.rightHip.add(this.rightShoeGroup);
  }

  /**
   * Update animation state based on locomotion speed and character state
   */
  update(dt, state, speed = 0, isGrounded = true, isPondering = false) {
    this.animTime += dt;

    // Smooth ponder transition
    const targetPonder = isPondering ? 1.0 : 0.0;
    this.ponderPose += (targetPonder - this.ponderPose) * Math.min(1.0, dt * 8.0);

    // Smooth flight transition
    const targetFlight = state === 'flying' ? 1.0 : 0.0;
    this.flightPose += (targetFlight - this.flightPose) * Math.min(1.0, dt * 6.0);

    // 1. Idle breathing
    const breath = Math.sin(this.animTime * 2.5) * 0.02;
    this.torsoGroup.position.y = 1.15 + breath;
    this.headGroup.position.y = 1.95 + breath * 1.5;

    // 2. Flight Pose (Peter Pan forward tilt and hero posture)
    if (this.flightPose > 0.01) {
      this.bodyRig.rotation.x = this.flightPose * (Math.PI * 0.32);
      this.bodyRig.position.y = this.flightPose * 0.2;

      // Right arm thrust forward, left arm back
      this.rightShoulder.rotation.x = THREE.MathUtils.lerp(this.rightShoulder.rotation.x, 1.45, this.flightPose);
      this.leftShoulder.rotation.x = THREE.MathUtils.lerp(this.leftShoulder.rotation.x, -0.65, this.flightPose);

      // Trailing streamlined legs
      this.leftHip.rotation.x = THREE.MathUtils.lerp(this.leftHip.rotation.x, -0.45, this.flightPose);
      this.rightHip.rotation.x = THREE.MathUtils.lerp(this.rightHip.rotation.x, -0.38, this.flightPose);
      return;
    }

    this.bodyRig.rotation.x = 0;

    // 3. Jump / Fall Pose (Airborne)
    if (!isGrounded) {
      this.leftHip.rotation.x = -0.35;
      this.rightHip.rotation.x = -0.25;
      this.leftShoulder.rotation.x = 0.45;
      this.rightShoulder.rotation.x = 0.45;
      this.leftShoulder.rotation.z = 0.45;
      this.rightShoulder.rotation.z = -0.45;
      return;
    }

    // 4. Locomotion Arm/Leg Swings (Grounded)
    if (speed > 0.15) {
      const freq = speed > 9.0 ? 14.0 : 8.5; // Running vs walking
      const amp = speed > 9.0 ? 0.75 : 0.45;
      const legAngle = Math.sin(this.animTime * freq) * amp;

      this.leftHip.rotation.x = legAngle;
      this.rightHip.rotation.x = -legAngle;

      // Arm swings opposite to legs
      if (this.ponderPose < 0.1) {
        this.leftShoulder.rotation.x = -legAngle * 0.85;
        this.rightShoulder.rotation.x = legAngle * 0.85;
        this.leftShoulder.rotation.z = 0.1;
        this.rightShoulder.rotation.z = -0.1;
      }

      // Torso bobbing on footfalls
      this.bodyRig.position.y = Math.abs(Math.sin(this.animTime * freq)) * 0.08;
    } else {
      // Idle
      this.leftHip.rotation.x = 0;
      this.rightHip.rotation.x = 0;
      this.bodyRig.position.y = 0;

      if (this.ponderPose < 0.1) {
        const armSway = Math.sin(this.animTime * 1.8) * 0.06;
        this.leftShoulder.rotation.x = armSway;
        this.rightShoulder.rotation.x = -armSway;
        this.leftShoulder.rotation.z = 0.12;
        this.rightShoulder.rotation.z = -0.12;
      }
    }

    // 5. Pondering "Hmm..." Chin-Stroke Pose
    if (this.ponderPose > 0.01) {
      // Left arm moves up so the white-gloved hand strokes the chin
      this.leftShoulder.rotation.x = THREE.MathUtils.lerp(this.leftShoulder.rotation.x, 1.48, this.ponderPose);
      this.leftShoulder.rotation.y = THREE.MathUtils.lerp(this.leftShoulder.rotation.y, 0.42, this.ponderPose);
      this.leftShoulder.rotation.z = THREE.MathUtils.lerp(this.leftShoulder.rotation.z, 0.35, this.ponderPose);

      // Right arm rests thoughtfully on hip
      this.rightShoulder.rotation.x = THREE.MathUtils.lerp(this.rightShoulder.rotation.x, 0.25, this.ponderPose);
      this.rightShoulder.rotation.z = THREE.MathUtils.lerp(this.rightShoulder.rotation.z, -0.38, this.ponderPose);

      // Head tilts inquisitively
      this.headGroup.rotation.z = THREE.MathUtils.lerp(this.headGroup.rotation.z, 0.16, this.ponderPose);
      this.headGroup.rotation.y = THREE.MathUtils.lerp(this.headGroup.rotation.y, 0.12, this.ponderPose);
    } else {
      this.leftShoulder.rotation.y = 0;
      this.headGroup.rotation.z = 0;
      this.headGroup.rotation.y = 0;
    }
  }

  dispose() {
    if (this.group && this.group.parent) {
      this.group.parent.remove(this.group);
    }
    // Clean up materials
    [
      this.matTunic, this.matTights, this.matSneakers, this.matSneakerSole,
      this.matGlove, this.matSkin, this.matCap, this.matBelt,
      this.matFeather, this.matEye, this.matEyeWhite
    ].forEach(m => m && m.dispose());
  }
}
