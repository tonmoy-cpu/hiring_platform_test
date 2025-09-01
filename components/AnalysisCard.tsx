"use client";

import { CheckCircle, AlertTriangle, TrendingUp, Brain } from 'lucide-react';

interface AnalysisResult {
  score: number;
  matchedSkills: string[];
  missingSkills: Array<{ skill: string; suggestion: string } | string>;
  feedback: string[];
  atsScore?: number;
  atsFeedback?: string[];
}

interface AnalysisCardProps {
  result: AnalysisResult;
  title?: string;
  className?: string;
}

export default function AnalysisCard({ 
  result, 
  title = "Analysis Results",
  className = "" 
}: AnalysisCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-danger';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-success';
    if (score >= 60) return 'bg-warning';
    return 'bg-danger';
  };

  return (
    <div className={`analysis-card fade-in-up ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Brain className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg text-foreground">{title}</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="text-center">
          <div className={`text-3xl font-bold ${getScoreColor(result.score)}`}>
            {result.score}%
          </div>
          <div className="text-sm text-gray-400">Job Match Score</div>
          <div className="mt-2 w-full bg-border h-2 rounded-full overflow-hidden">
            <div 
              className={`h-full ${getScoreBg(result.score)} transition-all duration-1000 ease-out`}
              style={{ width: `${result.score}%` }}
            ></div>
          </div>
        </div>
        
        {result.atsScore !== undefined && (
          <div className="text-center">
            <div className={`text-3xl font-bold ${getScoreColor(result.atsScore)}`}>
              {result.atsScore}%
            </div>
            <div className="text-sm text-gray-400">ATS Compatibility</div>
            <div className="mt-2 w-full bg-border h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full ${getScoreBg(result.atsScore)} transition-all duration-1000 ease-out`}
                style={{ width: `${result.atsScore}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>
      
      {result.matchedSkills.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-success" />
            <h4 className="font-medium text-success">Matched Skills</h4>
          </div>
          <div className="flex flex-wrap gap-1">
            {result.matchedSkills.map((skill, i) => (
              <span key={i} className="skill-match-indicator skill-matched">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {result.missingSkills.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <h4 className="font-medium text-warning">Skills to Develop</h4>
          </div>
          <div className="space-y-2">
            {result.missingSkills.slice(0, 5).map((skill, i) => (
              <div key={i} className="text-sm">
                <span className="skill-match-indicator skill-missing">
                  {typeof skill === 'string' ? skill : skill.skill}
                </span>
                {typeof skill === 'object' && skill.suggestion && (
                  <div className="text-gray-400 text-xs mt-1 ml-2">{skill.suggestion}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {result.feedback.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-info" />
            <h4 className="font-medium text-info">AI Recommendations</h4>
          </div>
          <ul className="space-y-1">
            {result.feedback.map((item, i) => (
              <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                <span className="text-info mt-1 flex-shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {result.atsFeedback && result.atsFeedback.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Brain className="h-4 w-4 text-primary" />
            <h4 className="font-medium text-primary">ATS Optimization</h4>
          </div>
          <ul className="space-y-1">
            {result.atsFeedback.map((item, i) => (
              <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                <span className="text-primary mt-1 flex-shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}