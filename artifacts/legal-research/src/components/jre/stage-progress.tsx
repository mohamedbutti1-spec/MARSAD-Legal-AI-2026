import React from 'react';
import { CheckCircle, Circle, Loader2, AlertCircle } from 'lucide-react';

interface StageProgressProps {
  status: string; // "pending" | "analyzing" | "complete" | "error"
}

const STAGES = [
  { id: 1, labelAr: 'استخراج الوقائع',    labelEn: 'Facts & Issues' },
  { id: 2, labelAr: 'استرداد المصادر',    labelEn: 'KB Retrieval' },
  { id: 3, labelAr: 'التحليل القانوني',   labelEn: 'Legal Analysis' },
  { id: 4, labelAr: 'مراجعة القرار الرقمي', labelEn: 'AI Review' },
  { id: 5, labelAr: 'التحليل النظري',     labelEn: 'Theory Mode' },
  { id: 6, labelAr: 'صياغة الحكم',        labelEn: 'Judgment' },
];

export function StageProgress({ status }: StageProgressProps) {
  const isComplete = status === 'complete';
  const isError    = status === 'error';
  const isActive   = status === 'analyzing';

  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between gap-1">
        {STAGES.map((stage, idx) => {
          const stageComplete = isComplete;
          const stageError    = isError && idx === 5;
          const stageActive   = isActive;

          return (
            <React.Fragment key={stage.id}>
              {/* Stage dot */}
              <div className="flex flex-col items-center gap-1 min-w-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    stageError
                      ? 'bg-destructive/15 text-destructive dark:bg-destructive/30 dark:text-destructive'
                      : stageComplete
                      ? 'bg-heading/15 text-heading dark:bg-heading/30 dark:text-heading'
                      : stageActive
                      ? 'bg-heading/15 text-heading dark:bg-heading/30 dark:text-heading'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {stageError ? (
                    <AlertCircle className="w-4 h-4" />
                  ) : stageComplete ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : stageActive ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Circle className="w-4 h-4" />
                  )}
                </div>
                <span className="text-[10px] text-center text-muted-foreground leading-tight max-w-[56px] hidden sm:block">
                  {stage.labelAr}
                </span>
              </div>

              {/* Connector */}
              {idx < STAGES.length - 1 && (
                <div className={`flex-1 h-0.5 mb-4 ${stageComplete ? 'bg-heading' : 'bg-border'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
