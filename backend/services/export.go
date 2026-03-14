package services

import (
	"encoding/json"
	"fmt"
	"threelab/models"
)

// ExportHTML generates a standalone HTML file with the scene genome and Three.js CDN.
func ExportHTML(scene models.Scene) string {
	genomeJSON, _ := json.MarshalIndent(scene.Genome, "    ", "  ")

	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>%s - Threelab Export</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: hidden; background: #000; }
    canvas { display: block; width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <canvas id="canvas"></canvas>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script>
    // Threelab Genome
    const genome = %s;

    // TODO: Full Threelab runtime — render genome layers using Three.js
    // For now, initialize a basic Three.js scene as a placeholder
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    camera.position.z = 5;

    // Parse background color from genome
    const bgColor = genome.globalParams?.backgroundColor || '#000000';
    scene.background = new THREE.Color(bgColor);

    function animate() {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  </script>
</body>
</html>`, scene.Name, string(genomeJSON))
}

// ExportReact generates a React component that renders the scene.
func ExportReact(scene models.Scene) string {
	genomeJSON, _ := json.MarshalIndent(scene.Genome, "  ", "  ")

	return fmt.Sprintf(`import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const genome = %s;

export default function ThreelabScene() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    camera.position.z = 5;

    const bgColor = genome.globalParams?.backgroundColor || '#000000';
    scene.background = new THREE.Color(bgColor);

    let animationId;
    function animate() {
      animationId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();

    const handleResize = () => {
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} style={{ width: '100%%', height: '100%%' }} />;
}
`, string(genomeJSON))
}

// ExportJSON returns just the genome as JSON.
func ExportJSON(scene models.Scene) string {
	genomeJSON, _ := json.MarshalIndent(scene.Genome, "", "  ")
	return string(genomeJSON)
}
