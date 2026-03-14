import "./style.css";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";

/* LOADER UI */

const loadingBar = document.querySelector("#loading-bar");
const loadingContainer = document.querySelector("#loading");

/* SCENE */

const canvas = document.querySelector("#scene");
const scene = new THREE.Scene();

/* CAMERA */

const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
);

/* RENDERER */

const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMappingExposure = 1.2;
/* HDRI ENVIRONMENT */

const exrLoader = new EXRLoader();
let envRotation = 0;

scene.environmentRotation = new THREE.Euler(0, 0, 0);

exrLoader.load("/hdri/studio.exr", (texture) => {

    const pmrem = new THREE.PMREMGenerator(renderer)
    pmrem.compileEquirectangularShader()

    const envMap = pmrem.fromEquirectangular(texture).texture

    scene.environment = envMap

    /* SKY SPHERE */

    const geometry = new THREE.SphereGeometry(50, 64, 64)

    const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.BackSide
    })

    const sky = new THREE.Mesh(geometry, material)
    scene.add(sky)

    texture.dispose()
    pmrem.dispose()

    sky.scale.set(1, 1, 1)
        //sky.position.y = 15

})

/* LIGHT */

const dirLight = new THREE.DirectionalLight(0xffffff, 1);

dirLight.position.set(5, 10, 5);

dirLight.castShadow = true;

dirLight.shadow.mapSize.set(4096, 4096);

dirLight.shadow.camera.left = -6;
dirLight.shadow.camera.right = 6;
dirLight.shadow.camera.top = 6;
dirLight.shadow.camera.bottom = -6;

dirLight.shadow.camera.near = 1;
dirLight.shadow.camera.far = 20;

dirLight.shadow.bias = -0.0004;
dirLight.shadow.radius = 5;

scene.add(dirLight);

/* FILL LIGHT (studio style) */

const fillLight = new THREE.DirectionalLight(0xffffff, 0.35);
fillLight.position.set(-5, 6, -5);

scene.add(fillLight);

/* FLOOR (soft contact shadow) */

const floor = new THREE.Mesh(
    new THREE.CircleGeometry(20, 64),

    new THREE.ShadowMaterial({
        opacity: 0.35,
    }),
);

floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.01;

floor.receiveShadow = true;

scene.add(floor);

/* CAMERA RIG */

const cameraRig = {
    radius: 8,
    minRadius: 1,
    maxRadius: 50,

    theta: Math.PI / 4,
    phi: Math.PI / 3,

    targetTheta: Math.PI / 4,
    targetPhi: Math.PI / 3,
};

/* MODEL LOADING */

const loader = new GLTFLoader();

loader.load(
    "/models/vehicle.glb",

    (gltf) => {
        const model = gltf.scene;

        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        scene.add(model);

        /* AUTO CENTER */

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        model.position.sub(center);

        /* CAMERA DISTANCE */

        const maxDim = Math.max(size.x, size.y, size.z);

        cameraRig.minRadius = maxDim * 0.85;
        cameraRig.radius = cameraRig.minRadius;
        cameraRig.maxRadius = cameraRig.minRadius * 1.8;

        loadingContainer.style.display = "none";
    },

    (xhr) => {
        const progress = xhr.loaded / xhr.total;
        loadingBar.style.width = progress * 100 + "%";
    },
);

/* CAMERA UPDATE */

function updateCamera() {
    cameraRig.theta += (cameraRig.targetTheta - cameraRig.theta) * 0.08;
    cameraRig.phi += (cameraRig.targetPhi - cameraRig.phi) * 0.08;

    cameraRig.phi = THREE.MathUtils.clamp(cameraRig.phi, 0.05, Math.PI / 2);

    const x =
        cameraRig.radius * Math.sin(cameraRig.phi) * Math.sin(cameraRig.theta);

    const y = cameraRig.radius * Math.cos(cameraRig.phi);

    const z =
        cameraRig.radius * Math.sin(cameraRig.phi) * Math.cos(cameraRig.theta);

    camera.position.set(x, y, z);

    camera.lookAt(0, 0, 0);
}

/* AUTO ROTATE */

let idleTime = 0;

function autoRotate() {
    if (idleTime > 3) {
        cameraRig.targetTheta += 0.002;
    }
}

/* BUTTON VIEWS */

document.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
        idleTime = 0;

        const view = btn.dataset.view;

        switch (view) {
            case "front":
                cameraRig.targetTheta = 0;
                cameraRig.targetPhi = Math.PI / 3;
                break;

            case "back":
                cameraRig.targetTheta = Math.PI;
                cameraRig.targetPhi = Math.PI / 3;
                break;

            case "left":
                cameraRig.targetTheta = -Math.PI / 2;
                cameraRig.targetPhi = Math.PI / 3;
                break;

            case "right":
                cameraRig.targetTheta = Math.PI / 2;
                cameraRig.targetPhi = Math.PI / 3;
                break;

            case "top":
                cameraRig.targetPhi = 0.12;
                break;
        }
    });
});

/* MOUSE ROTATION */

let isDragging = false;
let prev = { x: 0, y: 0 };

canvas.addEventListener("mousedown", (e) => {
    isDragging = true;
    prev.x = e.clientX;
    prev.y = e.clientY;
});

window.addEventListener("mouseup", () => {
    isDragging = false;
});

window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    idleTime = 0;

    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;

    cameraRig.targetTheta -= dx * 0.005;
    cameraRig.targetPhi -= dy * 0.005;

    prev.x = e.clientX;
    prev.y = e.clientY;
});

/* ZOOM */

window.addEventListener("wheel", (e) => {
    idleTime = 0;

    cameraRig.radius += e.deltaY * 0.01;

    cameraRig.radius = THREE.MathUtils.clamp(
        cameraRig.radius,
        cameraRig.minRadius,
        cameraRig.maxRadius
    );
});

/* RESIZE */

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
});

/* LOOP */

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    idleTime += delta;

    autoRotate();

    updateCamera();

    envRotation += delta * 0.1;

    scene.environmentRotation.y = envRotation;

    renderer.render(scene, camera);
}
animate()

let resizeTimeout;

window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);

    resizeTimeout = setTimeout(() => {
        location.reload();
    }, 500);
});