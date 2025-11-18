import React, { useState, useEffect } from "react";
import "./Home.css";
import { getLessons } from "../services/apiService";

const Home = () => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [lessons, setLessons] = useState([]);
  const [topic, setTopic] = useState("");

  useEffect(() => {
    const fetchLessons = async () => {
      try {
        const data = await getLessons();
        if (data.status === 'success') {
          setLessons(data.lessons);
        }
      } catch (error) {
        console.error("Failed to fetch lessons:", error);
      }
    };
    fetchLessons();
  }, []);

  const handleSubmit = () => {
    setIsSubmitted(true);
  };

  const handleTriggerChildProcess = async () => {
    if (window.electronAPI) {
      try {
        await window.electronAPI.triggerChildProcess();
      } catch (error) {
        console.error("Error triggering child process: ", error);
      }
    } else {
      console.error("Not running in Electron environment");
    }
  };

  if (isSubmitted) {
    return (
      <div className="home-container">
        <section className="hero-section">
          <div className="hero-background"></div>
          <div
            style={{
              width: "60%",
              margin: "0 auto",
              padding: "40px 32px 200px",
            }}>
            <h2
              style={{
                fontSize: 36,
                marginBottom: 40,
                color: "#2d2d2d",
                fontFamily: "inherit",
              }}>
              <i>Lessons to be learned...</i>
            </h2>
            <ol
              style={{
                fontSize: 18,
                lineHeight: 1.8,
                fontFamily: "inherit",
                color: "#2d2d2d",
                paddingLeft: 30,
              }}>
              {lessons.map((lesson) => (
                <li
                  key={lesson.lesson_id}
                  style={{
                    marginBottom: 24,
                  }}>
                  <strong>{lesson.name}:</strong> {lesson.description}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "24px 32px",
            background: "transparent",
            zIndex: 1000,
            display: "flex",
            justifyContent: "center",
          }}>
          <button
            onClick={handleTriggerChildProcess}
            style={{
              height: 72,
              padding: "0 80px",
              borderRadius: 40,
              border: "none",
              background: "#3b82f6",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: 20,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
              transition: "all 0.2s ease",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
              e.target.style.background = "#2563eb";
              e.target.style.transform = "scale(1.05)";
            }}
            onMouseLeave={(e) => {
              e.target.style.background = "#3b82f6";
              e.target.style.transform = "scale(1)";
            }}>
            Start
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="home-container">
      <section className="hero-section">
        <div className="hero-background"></div>
        <div className="hero-content">
          <h1 className="hero-title">
            Learn <i>Anything</i> Fast
          </h1>
        </div>
      </section>

      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "24px 32px",
          background: "transparent",
          zIndex: 1000,
        }}>
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            position: "relative",
          }}>
          <input
            type="text"
            placeholder="What do you want to learn today?"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            style={{
              width: "100%",
              height: 144,
              padding: "0 180px 0 28px",
              borderRadius: 80,
              border: "1.5px solid rgba(0,0,0,0.12)",
              outline: "none",
              fontSize: 18,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              transition: "all 0.2s ease",
              fontFamily: "inherit",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "rgba(59, 130, 246, 0.5)";
              e.target.style.boxShadow = "0 4px 12px rgba(59, 130, 246, 0.15)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "rgba(0,0,0,0.12)";
              e.target.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
            }}
          />
          <button
            onClick={handleSubmit}
            style={{
              position: "absolute",
              right: 16,
              top: "50%",
              transform: "translateY(-50%)",
              height: 112,
              width: 112,
              borderRadius: "50%",
              border: "none",
              background: "#3b82f6",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: 24,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
              transition: "all 0.2s ease",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
              e.target.style.background = "#2563eb";
              e.target.style.transform = "translateY(-50%) scale(1.05)";
            }}
            onMouseLeave={(e) => {
              e.target.style.background = "#3b82f6";
              e.target.style.transform = "translateY(-50%) scale(1)";
            }}>
            →
          </button>
        </div>
      </div>
    </div>
  );
};

export default Home;
