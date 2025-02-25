import React, { useRef, useEffect, useState } from 'react';
import { Holistic, POSE_CONNECTIONS } from '@mediapipe/holistic';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import styled, { keyframes } from 'styled-components';
import useSound from 'use-sound';

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
  font-size: 2rem;
  text-transform: uppercase;
  margin-bottom: 10px;
`;

const SelectContainer = styled.div`
  display: flex;
  justify-content: center;
  width: 100%;
  margin-bottom: 10px;
`;

const Select = styled.select`
  padding: 10px;
  font-size: 18px;
  border-radius: 5px;
  background: #FF8C00;
  color: white;
  border: none;
  cursor: pointer;
`;

const VideoContainer = styled.div`
  position: relative;
  width: 100%;
  height: 450px;
  max-width: 700px;
  background: #000;
  border-radius: 10px;
  overflow: hidden;
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
  margin-top: 20px;
  text-align: center;
  font-size: 18px;
  color: #fff;
`;

const ProgressBar = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  width: 100%;
  max-width: 700px;
  margin: 15px auto 0;
`;

const StepContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100px;
`;

const ProgressStep = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: bold;
  color: ${(props) => (props.completed ? 'black' : 'white')};
  background: ${(props) => (props.completed ? 'green' : '#444')};
  transition: background 0.3s;
`;

const StepTitle = styled.span`
  margin-top: 5px;
  font-size: 14px;
  text-align: center;
  color: ${(props) => (props.completed ? 'green' : '#fff')};
`;

const FinalFeedback = styled.div`
  margin-top: 20px;
  font-size: 20px;
  color: #0f0;
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Modal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: #000;
  color: #FF8C00;
  padding: 40px;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 10px 25px rgba(255, 140, 0, 0.5);
  animation: ${fadeIn} 0.3s ease-in-out;
  border: 2px solid #FF8C00;
  max-width: 450px;

  h2 {
    margin-bottom: 20px;
    font-size: 24px;
    color: #FF8C00;
  }
  p {
    font-size: 18px;
    margin-bottom: 20px;
    color: #fff;
  }
  button {
    padding: 10px 20px;
    font-size: 16px;
    background: #FF8C00;
    border: none;
    border-radius: 5px;
    color: #000;
    cursor: pointer;
    transition: background 0.3s;
  }
  button:hover {
    background: #e69500;
  }
`;

// Definición de ejercicios
const EXERCISES = {
  SQUAT: "Sentadilla",
  BICEPS_CURL: "Curl de Bíceps",
  LUNGE: "Zancada",
  OVERHEAD_PRESS: "Press de Hombro",
  CALF_RAISE: "Elevación de Talones"
};

// Pasos técnicos para cada ejercicio
const SQUAT_STEPS = [
  "Flexiona la rodilla hasta alcanzar ~100° para bajar el cuerpo",
  "Extiende la rodilla hasta superar ~160° para volver a la posición erguida"
];

const BICEPS_CURL_STEPS = [
  "Flexiona el codo",
  "Extiende el brazo"
];

const LUNGE_STEPS = [
  "Baja en la zancada con el ángulo de la rodilla ~90°",
  "Vuelve a la posición inicial extendiendo la pierna"
];

const OVERHEAD_PRESS_STEPS = [
  "Levanta el brazo por encima del hombro",
  "Baja el brazo a la posición inicial"
];

const CALF_RAISE_STEPS = [
  "Eleva los talones (ponte de puntillas)",
  "Baja lentamente a la posición inicial"
];

// Función de suavizado exponencial para landmarks
const smoothingFactor = 0.07;
const smoothPoint = (key, newPoint, filteredPoints) => {
  if (!filteredPoints[key]) {
    filteredPoints[key] = newPoint;
  } else {
    filteredPoints[key] = {
      x: filteredPoints[key].x * (1 - smoothingFactor) + newPoint.x * smoothingFactor,
      y: filteredPoints[key].y * (1 - smoothingFactor) + newPoint.y * smoothingFactor,
      z: newPoint.z,
    };
  }
  return filteredPoints[key];
};

// Función para calcular el ángulo entre tres puntos (en grados)
const computeAngle = (A, B, C) => {
  const radians = Math.atan2(C.y - B.y, C.x - B.x) - Math.atan2(A.y - B.y, A.x - B.x);
  let angle = Math.abs(radians * (180.0 / Math.PI));
  if (angle > 180) angle = 360 - angle;
  return angle;
};

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const filteredPointsRef = useRef({});
  const [playSuccess] = useSound('/sounds/success.mp3');
  const stepsContainerRef = useRef(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);

  
  // Estado inicial: ningún ejercicio seleccionado
  const [exercise, setExercise] = useState("");
  
  // Modal de bienvenida (se muestra una única vez)

  // Estados para Sentadilla (2 pasos)
  const [squatCompletedSteps, setSquatCompletedSteps] = useState([false, false]);
  const [squatFeedbackMessage, setSquatFeedbackMessage] = useState("");

  // Estados para Curl de Bíceps (2 pasos)
  const [bicepsCompletedSteps, setBicepsCompletedSteps] = useState([false, false]);
  const [bicepsFeedbackMessage, setBicepsFeedbackMessage] = useState("");

  // Estados para Zancada (Lunge)
  const [lungeCompletedSteps, setLungeCompletedSteps] = useState([false, false]);
  const [lungeFeedbackMessage, setLungeFeedbackMessage] = useState("");

  // Estados para Press de Hombro
  const [overheadPressCompletedSteps, setOverheadPressCompletedSteps] = useState([false, false]);
  const [overheadPressFeedbackMessage, setOverheadPressFeedbackMessage] = useState("");

  // Estados para Elevación de Talones (Calf Raise)
  const [calfCompletedSteps, setCalfCompletedSteps] = useState([false, false]);
  const [calfFeedbackMessage, setCalfFeedbackMessage] = useState("");

  const [exerciseCompleted, setExerciseCompleted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const holdCounter = useRef(0);

  // Lógica para la Sentadilla
  const analyzeSquat = (landmarks) => {
    if (!landmarks) return;
    const hip = smoothPoint("hip", landmarks[23], filteredPointsRef.current);
    const knee = smoothPoint("knee", landmarks[25], filteredPointsRef.current);
    const ankle = smoothPoint("ankle", landmarks[27], filteredPointsRef.current);
    const angle = computeAngle(hip, knee, ankle);

    setSquatCompletedSteps(prevSteps => {
      const steps = [...prevSteps];
      if (!steps[0]) {
        if (angle < 140) {
          steps[0] = true;
          setSquatFeedbackMessage("Bajada detectada: ángulo ~" + Math.round(angle) + "°. Mantén esta posición.");
          holdCounter.current = 60;
        } else {
          setSquatFeedbackMessage("Flexiona la rodilla hasta alcanzar ~100°. Ángulo actual: " + Math.round(angle) + "°");
        }
      } else if (!steps[1]) {
        if (angle > 160) {
          steps[1] = true;
          setSquatFeedbackMessage("¡Ejercicio completado! Ángulo: " + Math.round(angle) + "°.");
          setShowModal(true);
          holdCounter.current = 0;
          playSuccess();
        } else {
          if (angle < 100) {
            holdCounter.current--;
            setSquatFeedbackMessage(`Mantén la posición: ${Math.ceil(holdCounter.current / 30)}s (Ángulo: ${Math.round(angle)}°)`);
          } else {
            setSquatFeedbackMessage("Extiende la rodilla hasta superar ~160°. Ángulo actual: " + Math.round(angle) + "°");
          }
        }
      }
      return steps;
    });
  };

  // Lógica para el Curl de Bíceps
  const analyzeBicepsCurl = (landmarks, ctx) => {
    if (!landmarks || !ctx) return;
    const shoulder = smoothPoint("shoulder_d", landmarks[12], filteredPointsRef.current);
    const elbow = smoothPoint("elbow_d", landmarks[14], filteredPointsRef.current);
    const wrist = smoothPoint("wrist_d", landmarks[16], filteredPointsRef.current);
    const elbowAngle = computeAngle(shoulder, elbow, wrist);

    setBicepsCompletedSteps(prevSteps => {
      const steps = [...prevSteps];
      if (!steps[0]) {
        if (elbowAngle < 90) {
          steps[0] = true;
          setBicepsFeedbackMessage("Flexión detectada. Mantén la posición.");
          holdCounter.current = 60;
        } else {
          setBicepsFeedbackMessage("Flexiona el codo derecho para iniciar el curl.");
        }
      } else if (!steps[1]) {
        if (elbowAngle > 160) {
          steps[1] = true;
          setBicepsFeedbackMessage("¡Ejercicio completado con éxito!");
          setShowModal(true);
          holdCounter.current = 0;
          playSuccess();
        } else {
          if (elbowAngle < 90) {
            holdCounter.current--;
            setBicepsFeedbackMessage(`Mantén la posición: ${Math.ceil(holdCounter.current / 30)}s`);
          } else {
            setBicepsFeedbackMessage("Baja el brazo para finalizar el curl.");
          }
        }
      }
      return steps;
    });

    const color = elbowAngle < 90 ? "#00FF00" : "#FFFFFF";
    ctx.save();
    drawConnectors(ctx, [shoulder, elbow, wrist], [[shoulder, elbow], [elbow, wrist]], { color, lineWidth: 5 });
    ctx.font = "20px Arial";
    ctx.fillStyle = color;
    ctx.fillText(`Ángulo: ${Math.round(elbowAngle)}°`, elbow.x * ctx.canvas.width, elbow.y * ctx.canvas.height);
    ctx.restore();
  };

  // Lógica para la Zancada (Lunge) usando la pierna derecha
  const analyzeLunge = (landmarks) => {
    if (!landmarks) return;
    const hip = smoothPoint("hip_r", landmarks[24], filteredPointsRef.current);
    const knee = smoothPoint("knee_r", landmarks[26], filteredPointsRef.current);
    const ankle = smoothPoint("ankle_r", landmarks[28], filteredPointsRef.current);
    const angle = computeAngle(hip, knee, ankle);

    setLungeCompletedSteps(prevSteps => {
      const steps = [...prevSteps];
      if (!steps[0]) {
        if (angle < 110) {
          steps[0] = true;
          setLungeFeedbackMessage("Zancada detectada: ángulo ~" + Math.round(angle) + "°. Mantén esta posición.");
          holdCounter.current = 60;
        } else {
          setLungeFeedbackMessage("Baja en la zancada: flexiona la rodilla a ~90°. Ángulo actual: " + Math.round(angle) + "°");
        }
      } else if (!steps[1]) {
        if (angle > 160) {
          steps[1] = true;
          setLungeFeedbackMessage("¡Ejercicio completado! Ángulo: " + Math.round(angle) + "°.");
          setShowModal(true);
          holdCounter.current = 0;
          playSuccess();
        } else {
          if (angle < 110) {
            holdCounter.current--;
            setLungeFeedbackMessage(`Mantén la posición: ${Math.ceil(holdCounter.current / 30)}s (Ángulo: ${Math.round(angle)}°)`);
          } else {
            setLungeFeedbackMessage("Extiende la pierna para volver a la posición inicial. Ángulo actual: " + Math.round(angle) + "°");
          }
        }
      }
      return steps;
    });
  };

  // Lógica para el Press de Hombro usando el brazo izquierdo
  const analyzeOverheadPress = (landmarks) => {
    if (!landmarks) return;
    const shoulder = smoothPoint("shoulder_l", landmarks[11], filteredPointsRef.current);
    const wrist = smoothPoint("wrist_l", landmarks[15], filteredPointsRef.current);

    setOverheadPressCompletedSteps(prevSteps => {
      const steps = [...prevSteps];
      if (!steps[0]) {
        if (wrist.y < shoulder.y) {
          steps[0] = true;
          setOverheadPressFeedbackMessage("Brazo levantado. Mantén la posición.");
          holdCounter.current = 60;
        } else {
          setOverheadPressFeedbackMessage("Levanta el brazo por encima del hombro.");
        }
      } else if (!steps[1]) {
        if (wrist.y >= shoulder.y) {
          steps[1] = true;
          setOverheadPressFeedbackMessage("¡Ejercicio completado con éxito!");
          setShowModal(true);
          holdCounter.current = 0;
          playSuccess();
        } else {
          holdCounter.current--;
          setOverheadPressFeedbackMessage(`Mantén la posición: ${Math.ceil(holdCounter.current / 30)}s`);
        }
      }
      return steps;
    });
  };

  // Lógica para la Elevación de Talones usando la pierna derecha
  const analyzeCalfRaise = (landmarks) => {
    if (!landmarks) return;
    const ankle = smoothPoint("ankle_r_calf", landmarks[28], filteredPointsRef.current);
    const heel = smoothPoint("heel_r", landmarks[30], filteredPointsRef.current);
    const diff = ankle.y - heel.y; // Si el talón se eleva, diff aumenta

    setCalfCompletedSteps(prevSteps => {
      const steps = [...prevSteps];
      if (!steps[0]) {
        if (diff > 0.05) {
          steps[0] = true;
          setCalfFeedbackMessage("Elevación detectada: diferencia " + diff.toFixed(2) + ". Mantén la posición.");
          holdCounter.current = 60;
        } else {
          setCalfFeedbackMessage("Eleva tus talones, ponte de puntillas.");
        }
      } else if (!steps[1]) {
        if (diff < 0.03) {
          steps[1] = true;
          setCalfFeedbackMessage("¡Ejercicio completado! Diferencia: " + diff.toFixed(2));
          setShowModal(true);
          holdCounter.current = 0;
          playSuccess();
        } else {
          if (diff > 0.05) {
            holdCounter.current--;
            setCalfFeedbackMessage(`Mantén la posición: ${Math.ceil(holdCounter.current / 30)}s (Diferencia: ${diff.toFixed(2)})`);
          } else {
            setCalfFeedbackMessage("Baja lentamente los talones.");
          }
        }
      }
      return steps;
    });
  };

  useEffect(() => {
    async function loadHolistic() {
      const { Holistic } = await import("@mediapipe/holistic");
      const holistic = new Holistic({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
      });
      holistic.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.9,
        minTrackingConfidence: 0.9,
      });
      holistic.onResults((results) => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      
        // Obtener el video para calcular las dimensiones
        const video = videoRef.current;
        if (video) {
          const videoWidth = video.videoWidth;   // Resolución original (ej. 640)
          const videoHeight = video.videoHeight; // Resolución original (ej. 480)
          const containerWidth = video.clientWidth;   // Dimensiones mostradas en mobile
          const containerHeight = video.clientHeight;
      
          // Calcular el factor de escala y los offsets
          const scale = Math.max(containerWidth / videoWidth, containerHeight / videoHeight);
          const xOffset = (containerWidth - videoWidth * scale) / 2;
          const yOffset = (containerHeight - videoHeight * scale) / 2;
      
          // Aplicar transformación para alinear los dibujos con el video
          ctx.save();
          ctx.translate(xOffset, yOffset);
          ctx.scale(scale, scale);
      
          // Dibuja los landmarks y conectores
          if (results.poseLandmarks) {
            drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
              color: "#00FF00",
              lineWidth: 4,
            });
            drawLandmarks(ctx, results.poseLandmarks, {
              color: "#FFD700",
              radius: 5,
            });
          }
          ctx.restore();
        }

        // Solo analizar si se ha seleccionado un ejercicio
        if (exercise === EXERCISES.SQUAT) {
          analyzeSquat(results.poseLandmarks);
        } else if (exercise === EXERCISES.BICEPS_CURL) {
          analyzeBicepsCurl(results.poseLandmarks, ctx);
        } else if (exercise === EXERCISES.LUNGE) {
          analyzeLunge(results.poseLandmarks);
        } else if (exercise === EXERCISES.OVERHEAD_PRESS) {
          analyzeOverheadPress(results.poseLandmarks);
        } else if (exercise === EXERCISES.CALF_RAISE) {
          analyzeCalfRaise(results.poseLandmarks);
        }
      });
      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          await holistic.send({ image: videoRef.current });
        },
        width: 640,
        height: 480,
      });
      camera.start();
    }
    loadHolistic();
  }, [exercise]);
  
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.addEventListener('loadedmetadata', () => {
        // Ajusta el canvas al tamaño real del video
        canvasRef.current.width = video.videoWidth;
        canvasRef.current.height = video.videoHeight;
      });
    }
  }, []);
  

  const handleExerciseChange = (e) => {
    setExercise(e.target.value);
    // Reiniciamos todos los estados al cambiar de ejercicio
    setSquatCompletedSteps([false, false]);
    setSquatFeedbackMessage("");
    setBicepsCompletedSteps([false, false]);
    setBicepsFeedbackMessage("");
    setLungeCompletedSteps([false, false]);
    setLungeFeedbackMessage("");
    setOverheadPressCompletedSteps([false, false]);
    setOverheadPressFeedbackMessage("");
    setCalfCompletedSteps([false, false]);
    setCalfFeedbackMessage("");
    setExerciseCompleted(false);
    setShowModal(false);
    holdCounter.current = 0;
  };

  // Seleccionamos los pasos y mensajes según el ejercicio actual
  let stepsArray = [];
  let feedback = "";
  let completedSteps = [];
  if (exercise === EXERCISES.SQUAT) {
    stepsArray = SQUAT_STEPS;
    feedback = squatFeedbackMessage;
    completedSteps = squatCompletedSteps;
  } else if (exercise === EXERCISES.BICEPS_CURL) {
    stepsArray = BICEPS_CURL_STEPS;
    feedback = bicepsFeedbackMessage;
    completedSteps = bicepsCompletedSteps;
  } else if (exercise === EXERCISES.LUNGE) {
    stepsArray = LUNGE_STEPS;
    feedback = lungeFeedbackMessage;
    completedSteps = lungeCompletedSteps;
  } else if (exercise === EXERCISES.OVERHEAD_PRESS) {
    stepsArray = OVERHEAD_PRESS_STEPS;
    feedback = overheadPressFeedbackMessage;
    completedSteps = overheadPressCompletedSteps;
  } else if (exercise === EXERCISES.CALF_RAISE) {
    stepsArray = CALF_RAISE_STEPS;
    feedback = calfFeedbackMessage;
    completedSteps = calfCompletedSteps;
  }

  return (
    <Container>
      <Header>{exercise || "Ejercicio"}</Header>
      <SelectContainer>
        <Select value={exercise} onChange={handleExerciseChange}>
          <option value="">Selecciona un ejercicio</option>
          <option value={EXERCISES.SQUAT}>Sentadilla</option>
          <option value={EXERCISES.BICEPS_CURL}>Curl de Bíceps</option>
          <option value={EXERCISES.LUNGE}>Zancada</option>
          <option value={EXERCISES.OVERHEAD_PRESS}>Press de Hombro</option>
          <option value={EXERCISES.CALF_RAISE}>Elevación de Talones</option>
        </Select>
      </SelectContainer>
      <VideoContainer>
        <VideoStyled ref={videoRef} autoPlay playsInline muted />
        <CanvasStyled ref={canvasRef} width={640} height={480} />
      </VideoContainer>
      <FeedbackContainer>
        <ProgressBar>
          {stepsArray.map((stepText, index) => (
            <StepContainer key={index}>
              <ProgressStep completed={completedSteps[index]}>
                {index + 1}
              </ProgressStep>
              <StepTitle completed={completedSteps[index]}>
                {stepText}
              </StepTitle>
            </StepContainer>
          ))}
        </ProgressBar>
        {feedback && <FinalFeedback>{feedback}</FinalFeedback>}
      </FeedbackContainer>
      {showModal && (
        <Modal>
          <ModalContent>
            <h2>Ejercicio completado con éxito</h2>
            <p>{feedback}</p>
            <button onClick={() => {
              setShowModal(false);
              if (exercise === EXERCISES.SQUAT) {
                setSquatCompletedSteps([false, false]);
                setSquatFeedbackMessage("");
              } else if (exercise === EXERCISES.BICEPS_CURL) {
                setBicepsCompletedSteps([false, false]);
                setBicepsFeedbackMessage("");
              } else if (exercise === EXERCISES.LUNGE) {
                setLungeCompletedSteps([false, false]);
                setLungeFeedbackMessage("");
              } else if (exercise === EXERCISES.OVERHEAD_PRESS) {
                setOverheadPressCompletedSteps([false, false]);
                setOverheadPressFeedbackMessage("");
              } else if (exercise === EXERCISES.CALF_RAISE) {
                setCalfCompletedSteps([false, false]);
                setCalfFeedbackMessage("");
              }
            }}>Cerrar</button>
          </ModalContent>
        </Modal>
      )}
      {showWelcomeModal && (
        <Modal>
          <ModalContent>
            <h2>Instrucciones</h2>
            <p>
              Asegúrate de enfocar bien la cámara para que el sistema pueda interpretar correctamente tus movimientos según el ejercicio que vayas a realizar.
            </p>
            <button
              onClick={() => {
                setShowWelcomeModal(false);
                // Realiza el scroll hacia el contenedor deseado
                stepsContainerRef.current?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Cerrar
            </button>
          </ModalContent>
        </Modal>
      )}
    </Container>
  );
}

export default App;
