import React, { useRef, useEffect, useState } from 'react';
import { Holistic, POSE_CONNECTIONS } from '@mediapipe/holistic';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import styled from 'styled-components';

// =======================
// ESTILOS CON STYLED-COMPONENTS
// =======================
const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  font-family: 'Helvetica Neue', sans-serif;
  background: #000;
  min-height: 100vh;
  color: #fff;
`;

const Header = styled.h1`
  color: #FF8C00;
  font-family: 'Roboto', sans-serif;
  font-size: 2rem;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid #FF8C00;
`;

const VideoContainer = styled.div`
  position: relative;
  width: 100%;
  height: 450px;
  max-width: 700px;
  aspect-ratio: 16/9;
  background: #000;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const VideoStyled = styled.video`
  width: 100%;
  height: 100%;
  object-fit: cover;
  position: absolute;
`;

const CanvasStyled = styled.canvas`
  position: absolute;
  top: 0;
  left: 0;
`;

const FeedbackContainer = styled.div`
  width: 100%;
  max-width: 700px;
  background: #222;
  border-radius: 10px;
  padding: 15px;
  margin-bottom: 20px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  text-align: center;
  font-size: 18px;
  color: #fff;
`;

const ButtonGroup = styled.div`
  display: flex;
  justify-content: center;
  gap: 15px;
  flex-wrap: wrap;
`;

const ExerciseButton = styled.button`
  background: ${(props) => (props.active ? '#e07b00' : '#FF8C00')};
  color: #fff;
  border: 2px solid #FF8C00;
  border-radius: 20px;
  padding: 10px 20px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  &:hover {
    background: #e07b00;
  }
`;

const ZoomContainer = styled.div`
  margin: 10px 0;
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const ZoomSlider = styled.input`
  width: 300px;
`;

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const correctCountRef = useRef(0);
  const CORRECT_THRESHOLD = 50;

  const [feedback, setFeedback] = useState('');
  const [progress, setProgress] = useState(0);
  const [selectedExercise, setSelectedExercise] = useState('squat');
  const [zoom, setZoom] = useState(1);

  const idealAngles = {
    squat: 85,         // Sentadilla: ángulo ideal de la rodilla
    biceps: 35,        // Bíceps Curl: ángulo ideal del codo
    sumoDeadlift: 115, // Peso Muerto Sumo: ángulo ideal del torso
    crunch: 110        // Crunch: ángulo ideal (nariz-hombro-cadera)
  };

  // Función para calcular el ángulo entre 3 puntos (en grados)
  const computeAngle = (A, B, C) => {
    const radians =
      Math.atan2(C.y - B.y, C.x - B.x) -
      Math.atan2(A.y - B.y, A.x - B.x);
    let angle = Math.abs(radians * (180.0 / Math.PI));
    if (angle > 180) angle = 360 - angle;
    return angle;
  };

  // Función definida de manera normal (sin useCallback)
  const analyzeExercise = (landmarks) => {
    if (!landmarks) return;
    
    let isCorrect = false;
    let localFeedback = '';
    let currentAngle = 0;
    let ideal = 0;

    if (selectedExercise === 'squat') {
      // Sentadillas
      const hip = landmarks[23];
      const knee = landmarks[25];
      const ankle = landmarks[27];
      currentAngle = computeAngle(hip, knee, ankle);
      ideal = idealAngles.squat;
      if (currentAngle > 160) {
        localFeedback = '¡Estás de pie! Baja para iniciar la sentadilla.';
      } else if (currentAngle <= 160 && currentAngle > ideal) {
        localFeedback = 'Bajando... Acerca tu ángulo a ' + ideal + '°.';
      } else if (currentAngle <= ideal) {
        localFeedback = '¡Sentadilla perfecta! Mantén la posición.';
        isCorrect = true;
      }
    } else if (selectedExercise === 'biceps') {
      // Bíceps Curl
      const shoulder = landmarks[12];
      const elbow = landmarks[14];
      const wrist = landmarks[16];
      currentAngle = computeAngle(shoulder, elbow, wrist);
      ideal = idealAngles.biceps;
      if (currentAngle > 160) {
        localFeedback = 'Brazo extendido. Flexiona el codo para iniciar el curl.';
      } else if (currentAngle <= 160 && currentAngle > ideal) {
        localFeedback = 'En movimiento... Trata de alcanzar ' + ideal + '°.';
      } else if (currentAngle <= ideal) {
        localFeedback = '¡Curl perfecto! Mantén el codo pegado al torso.';
        isCorrect = true;
      }
    } else if (selectedExercise === 'sumoDeadlift') {
      // Peso Muerto Sumo
      const shoulder = landmarks[11];
      const hip = landmarks[23];
      const knee = landmarks[25];
      currentAngle = computeAngle(shoulder, hip, knee);
      ideal = idealAngles.sumoDeadlift;
      if (currentAngle > 170) {
        localFeedback = 'Posición inicial. Baja la cadera para iniciar.';
      } else if (currentAngle <= 170 && currentAngle > ideal) {
        localFeedback = 'Bajando... Acerca el ángulo a ' + ideal + '°.';
      } else if (currentAngle <= ideal) {
        localFeedback = '¡Peso muerto sumo perfecto! Mantén la postura.';
        isCorrect = true;
      }
    } else if (selectedExercise === 'crunch') {
      // Crunch
      const nose = landmarks[0];
      const shoulder = landmarks[12];
      const hip = landmarks[24];
      currentAngle = computeAngle(nose, shoulder, hip);
      ideal = idealAngles.crunch;
      if (currentAngle > 160) {
        localFeedback = 'Inicia el crunch levantando el torso.';
      } else if (currentAngle <= 160 && currentAngle > ideal) {
        localFeedback = 'Crunch en progreso... Trata de alcanzar ' + ideal + '°.';
      } else if (currentAngle <= ideal) {
        localFeedback = '¡Crunch perfecto! Mantén la contracción.';
        isCorrect = true;
      }
    }

    // Actualizar el contador de fotogramas correctos
    if (isCorrect) {
      correctCountRef.current = Math.min(correctCountRef.current + 1, CORRECT_THRESHOLD);
    } else {
      correctCountRef.current = 0;
    }
    setProgress(Math.round((correctCountRef.current / CORRECT_THRESHOLD) * 100));

    // Si se mantiene la postura perfecta durante los fotogramas requeridos, se aprueba el ejercicio
    if (correctCountRef.current === CORRECT_THRESHOLD) {
      localFeedback = `${localFeedback} — ¡Ejercicio aprobado!`;
    }
    setFeedback(localFeedback);

    // Dibujo de indicadores en el canvas:
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.font = '20px Arial';
      ctx.fillStyle = 'yellow';
      ctx.fillText(`Ángulo: ${Math.round(currentAngle)}° (Ideal: ${ideal}°)`, 10, 30);
    }
  };

  // Configuración de Mediapipe Holistic y cámara
  useEffect(() => {
    const holistic = new Holistic({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
    });
    holistic.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    holistic.onResults((results) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      canvas.width = 640;
      canvas.height = 480;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
      if (results.poseLandmarks) {
        drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 4 });
        drawLandmarks(ctx, results.poseLandmarks, { color: '#FF0000', lineWidth: 2 });
        analyzeExercise(results.poseLandmarks);
      }
    });
    let camera = null;
    if (videoRef.current) {
      camera = new Camera(videoRef.current, {
        onFrame: async () => {
          await holistic.send({ image: videoRef.current });
        },
        width: 640,
        height: 480,
      });
      camera.start();
    }
    return () => {
      if (camera) camera.stop();
    };
  }, [selectedExercise, analyzeExercise]);
  
  // Nota: Al definir analyzeExercise de forma normal, no lo incluimos en la dependencia, ya que se reconstruye en cada render

  return (
    <Container>
      <Header>Entrena con nuestra IA</Header>

      {/* Contenedor con control de zoom aplicado */}
      <VideoContainer style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}>
        <VideoStyled ref={videoRef} autoPlay playsInline muted />
        <CanvasStyled ref={canvasRef} width={640} height={480} />
      </VideoContainer>

      <FeedbackContainer>
        <strong>Feedback:</strong>
        <p>{feedback}</p>
        <p>Progreso: {progress}%</p>
      </FeedbackContainer>

      <ZoomContainer>
        <label htmlFor="zoom">Zoom:</label>
        <ZoomSlider
          id="zoom"
          type="range"
          min="1"
          max="3"
          step="0.1"
          value={zoom}
          onChange={(e) => setZoom(e.target.value)}
        />
      </ZoomContainer>

      <ButtonGroup>
        <ExerciseButton
          active={selectedExercise === 'squat'}
          onClick={() => {
            setSelectedExercise('squat');
            correctCountRef.current = 0;
            setProgress(0);
          }}
        >
          Sentadillas
        </ExerciseButton>
        <ExerciseButton
          active={selectedExercise === 'biceps'}
          onClick={() => {
            setSelectedExercise('biceps');
            correctCountRef.current = 0;
            setProgress(0);
          }}
        >
          Bíceps Curl
        </ExerciseButton>
        <ExerciseButton
          active={selectedExercise === 'sumoDeadlift'}
          onClick={() => {
            setSelectedExercise('sumoDeadlift');
            correctCountRef.current = 0;
            setProgress(0);
          }}
        >
          Peso Muerto Sumo
        </ExerciseButton>
        <ExerciseButton
          active={selectedExercise === 'crunch'}
          onClick={() => {
            setSelectedExercise('crunch');
            correctCountRef.current = 0;
            setProgress(0);
          }}
        >
          Crunch en Suelo
        </ExerciseButton>
      </ButtonGroup>
    </Container>
  );
}

export default App;
