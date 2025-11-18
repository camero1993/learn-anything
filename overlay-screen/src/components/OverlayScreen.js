import React, { useEffect, useState, useRef } from "react";
import "./OverlayScreen.css";
// Backend connections disabled
// import wsClient from "../services/webSocket";
import { startStep, getHelpTip, advanceStep, goToPreviousStep, getCurrentStep } from "../services/apiService";

const OverlayScreen = () => {
  const [header, setHeader] = useState("Step 1");
  const [allConversations, setAllConversations] = useState({});
  const [currentStepId, setCurrentStepId] = useState(null);
  const [question, setQuestion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const conversationEndRef = useRef(null);

  const scrollToBottom = () => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [allConversations, currentStepId]);

  const updateConversation = (stepId, newMessages) => {
    setAllConversations(prev => ({
      ...prev,
      [stepId]: newMessages,
    }));
  };

  useEffect(() => {
    const fetchCurrentStep = async () => {
      try {
        const response = await getCurrentStep();
        const data = response?.data;
        if (data?.status === "success" && data.step_info) {
          const stepId = `${data.lesson_id}-${data.step_order}`;
          setCurrentStepId(stepId);
          setHeader(data.step_info.name || "Current Step");
          if (!allConversations[stepId]) {
            updateConversation(stepId, [{ sender: 'ai', text: data.step_info.description || "Here is the current step." }]);
          }
        } else {
          const startResponse = await startStep();
          const startData = startResponse?.data;
          if (startData?.status === "success") {
            const stepId = `${startData.lesson_id}-${startData.step_order}`;
            setCurrentStepId(stepId);
            setHeader(startData.step_name || "First Step");
            updateConversation(stepId, [{ sender: 'ai', text: startData.step_description || "Welcome to the lesson!" }]);
          }
        }
      } catch (error) {
        console.error("Failed to fetch or initialize step:", error);
      }
    };
    fetchCurrentStep();
  }, []);

  const handleQuestionSubmit = async (e) => {
    e.preventDefault();
    if (question.trim() && !isSubmitting && currentStepId) {
      const currentConversation = allConversations[currentStepId] || [];
      const newConversation = [...currentConversation, { sender: 'user', text: question }];
      updateConversation(currentStepId, newConversation);
      setQuestion("");
      setIsSubmitting(true);
      
      try {
        const response = await getHelpTip(question, newConversation);
        if (response?.data?.status === "success" && response.data.help_tip) {
          updateConversation(currentStepId, [...newConversation, { sender: 'ai', text: response.data.help_tip }]);
        } else {
          updateConversation(currentStepId, [...newConversation, { sender: 'ai', text: "Sorry, I couldn't find an answer. Please try again." }]);
        }
      } catch (error) {
        console.error("Error getting help tip:", error);
        updateConversation(currentStepId, [...newConversation, { sender: 'ai', text: "An error occurred. Please check the console." }]);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleStepChange = (stepData) => {
    const stepId = `${stepData.lesson_id}-${stepData.step_order}`;
    setCurrentStepId(stepId);
    setHeader(stepData.step_info.name || "Step");
    if (!allConversations[stepId]) {
      updateConversation(stepId, [{ sender: 'ai', text: stepData.step_info.description || "Here are the instructions for this step." }]);
    }
  };

  const handlePrevious = async () => {
    if (isNavigating) return;
    setIsNavigating(true);
    try {
      const response = await goToPreviousStep();
      if (response?.data?.status === "success" && response.data.step_info) {
        handleStepChange(response.data);
      }
    } catch (error) {
      console.error("Error going to previous step:", error);
    } finally {
      setIsNavigating(false);
    }
  };

  const handleNext = async () => {
    if (isNavigating) return;
    setIsNavigating(true);
    try {
      const response = await advanceStep();
      const data = response?.data;
      if (data?.status === "success" && data.step_info) {
        handleStepChange(data);
      } else if (data?.lesson_completed) {
        const stepId = `${data.lesson_id}-completed`;
        setCurrentStepId(stepId);
        setHeader("Lesson Completed!");
        updateConversation(stepId, [{ sender: 'ai', text: "Congratulations, you have completed the lesson!" }]);
      }
    } catch (error) {
      console.error("Error advancing to next step:", error);
    } finally {
      setIsNavigating(false);
    }
  };

  const currentConversation = allConversations[currentStepId] || [];

  return (
    <div className="overlay-screen">
      <h1 className="overlay-header">{header}</h1>
      <div className="overlay-body">
        {currentConversation.map((message, index) => (
          <div key={index} className={`message ${message.sender}`}>
            <p>{message.text}</p>
          </div>
        ))}
        <div ref={conversationEndRef} />
      </div>
      <div className="overlay-navigation">
        <button className="overlay-nav-button overlay-nav-prev" onClick={handlePrevious} disabled={isNavigating}>
          <span className="overlay-nav-icon">←</span>
        </button>
        <button className="overlay-nav-button overlay-nav-next" onClick={handleNext} disabled={isNavigating}>
          <span className="overlay-nav-icon">→</span>
        </button>
      </div>
      <form className="overlay-question-form" onSubmit={handleQuestionSubmit}>
        <input
          type="text"
          className="overlay-question-input"
          placeholder={isSubmitting ? "Getting help..." : "Type your question here..."}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={isSubmitting || !currentStepId}
        />
      </form>
    </div>
  );
};

export default OverlayScreen;