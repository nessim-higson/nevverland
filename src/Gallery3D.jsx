import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { PHYSICS as P } from './config'

// ─────────────────────────────────────────────────────────────
// The WORK gallery — three.js.
//
// The project's frames hang as planes in a WebGL strip; drag or
// wheel to throw through them with inertia. The SHADER reacts to
// velocity (a still gallery is calm; a moving one bends light):
//
//   lens — barrel distortion + chromatic aberration, the recovered
//          Vincent-Lowe-style pass, driven by throw speed
//   wave — the frame ripples like cloth as it travels
//   rgb  — channel separation tears open with motion
//
// Effects are switchable live from the physics panel (P.FX) — the
// uniform updates every frame, no rebuild. Films play as
// VideoTextures. The navigation stays drawn above this canvas.
// ─────────────────────────────────────────────────────────────

const FX_ID = { lens: 0, wave: 1, rgb: 2 }

const VERT = /* glsl */ `
  uniform float uVel;
  uniform int uEffect;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    // the plane bows against its direction of travel
    p.z -= sin(uv.x * 3.14159) * min(abs(uVel) * 38.0, 60.0);
    if (uEffect == 1) {
      // wave: cloth ripple, amplitude grows with motion
      p.z += sin(uv.y * 9.0 + uv.x * 4.0) * min(abs(uVel) * 26.0, 42.0);
    }
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uVel;
  uniform float uTime;
  uniform int uEffect;
  varying vec2 vUv;

  float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  void main() {
    vec2 uv = vUv;
    float v = clamp(uVel, -1.0, 1.0);
    vec3 col;

    if (uEffect == 0) {
      // lens: barrel distortion from center + chromatic split
      vec2 c = uv - 0.5;
      float r2 = dot(c, c);
      float k = abs(v) * 0.55;
      vec2 d = c * (1.0 + k * r2 * 2.4);
      float ca = abs(v) * 0.018 + 0.0015;
      col.r = texture2D(uMap, 0.5 + d * (1.0 + ca)).r;
      col.g = texture2D(uMap, 0.5 + d).g;
      col.b = texture2D(uMap, 0.5 + d * (1.0 - ca)).b;
    } else if (uEffect == 1) {
      // wave: the texture swims with the cloth
      uv.x += sin(uv.y * 12.0 + uTime * 1.6) * 0.012 * (1.0 + abs(v) * 5.0);
      uv.y += sin(uv.x * 8.0 - uTime * 1.1) * 0.008 * (1.0 + abs(v) * 5.0);
      col = texture2D(uMap, uv).rgb;
    } else {
      // rgb: channel separation along the direction of travel
      float off = v * 0.05 + sin(uTime * 0.8) * 0.002;
      col.r = texture2D(uMap, uv + vec2(off, 0.0)).r;
      col.g = texture2D(uMap, uv).g;
      col.b = texture2D(uMap, uv - vec2(off, 0.0)).b;
    }

    // the study's monochrome
    float g = lum(col);
    gl_FragColor = vec4(vec3(g) * 0.92, 1.0);
  }
`

export default function Gallery3D({ media, startIndex = 0, width, height, onIndex }) {
  const hostRef = useRef(null)
  const idxRef = useRef(startIndex)
  const failedRef = useRef(false)

  // chip clicks re-target the strip without rebuilding the scene
  useEffect(() => {
    if (hostRef.current?.__goto) hostRef.current.__goto(startIndex)
  }, [startIndex])

  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host || failedRef.current) return

    // no WebGL (rare, but real) → static full-bleed fallback below
    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      failedRef.current = true
      setFailed(true)
      return
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    renderer.setSize(width, height)
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const cam = new THREE.OrthographicCamera(
      -width / 2, width / 2, height / 2, -height / 2, -1500, 1500
    )

    const planeH = height * 0.6
    const planeW = planeH * 0.78
    const SPACING = planeW + 110

    // textures: images load, films play
    const loader = new THREE.TextureLoader()
    const videos = []
    const meshes = media.map((m, i) => {
      let tex
      if (m.type === 'video') {
        const v = document.createElement('video')
        v.src = m.src
        v.muted = true
        v.loop = true
        v.playsInline = true
        v.play().catch(() => {})
        videos.push(v)
        tex = new THREE.VideoTexture(v)
      } else {
        tex = loader.load(m.src)
      }
      tex.colorSpace = THREE.SRGBColorSpace
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uMap: { value: tex },
          uVel: { value: 0 },
          uTime: { value: 0 },
          uEffect: { value: FX_ID[P.FX] ?? 0 },
        },
      })
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(planeW, planeH, 48, 48),
        mat
      )
      mesh.position.x = i * SPACING
      scene.add(mesh)
      return mesh
    })

    // drag / wheel → target scroll; the loop chases it with inertia
    let target = startIndex * SPACING
    let scroll = target
    let prev = scroll
    let drag = null
    const maxScroll = (media.length - 1) * SPACING

    host.__goto = (i) => {
      target = Math.max(0, Math.min(maxScroll, i * SPACING))
    }

    const onDown = (e) => {
      drag = { x: e.clientX, t: target }
      host.setPointerCapture?.(e.pointerId)
    }
    const onMove = (e) => {
      if (!drag) return
      target = Math.max(-SPACING * 0.4, Math.min(maxScroll + SPACING * 0.4, drag.t - (e.clientX - drag.x) * 1.6))
    }
    const onUp = () => {
      drag = null
      target = Math.max(0, Math.min(maxScroll, target))
    }
    const onWheel = (e) => {
      target = Math.max(0, Math.min(maxScroll, target + (e.deltaY + e.deltaX) * 1.1))
    }
    host.addEventListener('pointerdown', onDown)
    host.addEventListener('pointermove', onMove)
    host.addEventListener('pointerup', onUp)
    host.addEventListener('pointercancel', onUp)
    host.addEventListener('wheel', onWheel, { passive: true })

    let raf
    const clock = new THREE.Clock()
    const tick = () => {
      scroll += (target - scroll) * 0.085
      const vel = (scroll - prev) / SPACING
      prev = scroll
      const t = clock.getElapsedTime()
      const fx = FX_ID[P.FX] ?? 0

      meshes.forEach((mesh, i) => {
        mesh.position.x = i * SPACING - scroll
        mesh.material.uniforms.uVel.value = vel * 6
        mesh.material.uniforms.uTime.value = t
        mesh.material.uniforms.uEffect.value = fx
      })

      const idx = Math.round(Math.max(0, Math.min(maxScroll, scroll)) / SPACING)
      if (idx !== idxRef.current) {
        idxRef.current = idx
        onIndex?.(idx)
      }

      renderer.render(scene, cam)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      host.removeEventListener('pointerdown', onDown)
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerup', onUp)
      host.removeEventListener('pointercancel', onUp)
      host.removeEventListener('wheel', onWheel)
      videos.forEach((v) => v.pause())
      meshes.forEach((m) => {
        m.geometry.dispose()
        m.material.uniforms.uMap.value.dispose()
        m.material.dispose()
      })
      renderer.dispose()
      host.removeChild(renderer.domElement)
    }
  }, [media, width, height]) // eslint-disable-line react-hooks/exhaustive-deps

  if (failed) {
    const m = media[Math.min(startIndex, media.length - 1)]
    return (
      <div className="fullBleed">
        {m.type === 'video' ? (
          <video src={m.src} autoPlay muted loop playsInline />
        ) : (
          <img src={m.src} alt="" />
        )}
      </div>
    )
  }

  return <div className="glStage" ref={hostRef} />
}
