import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { NEU } from '../../utils/shadows';

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const QUESTIONS = [
  { text: 'Меня беспокоит усталость', reverse: false },
  { text: 'Я очень быстро устаю', reverse: false },
  { text: 'Я не делаю много дел в течение дня', reverse: false },
  { text: 'У меня достаточно энергии для повседневной жизни', reverse: true },
  { text: 'Я чувствую физическое истощение', reverse: false },
  { text: 'Мне трудно начать что-нибудь делать', reverse: false },
  { text: 'Мне трудно думать четко и ясно', reverse: false },
  { text: 'У меня нет никакого желания что-нибудь делать', reverse: false },
  { text: 'Я чувствую умственное истощение', reverse: false },
  { text: 'Когда я делаю что-нибудь, я могу довольно хорошо сконцентрироваться', reverse: true },
];

const OPTIONS = [
  { label: 'Никогда', value: 1 },
  { label: 'Редко', value: 2 },
  { label: 'Иногда', value: 3 },
  { label: 'Часто', value: 4 },
  { label: 'Всегда', value: 5 },
];

interface FatigueCheckProps {
  open: boolean;
  onClose: () => void;
}

export function FatigueCheck({ open, onClose }: FatigueCheckProps) {
  const [answers, setAnswers] = useState<(number | null)[]>(Array(10).fill(null));

  useEffect(() => {
    if (open) {
      setAnswers(Array(10).fill(null));
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const setAnswer = (index: number, value: number) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const answeredCount = answers.filter((a) => a !== null).length;
  const allAnswered = answeredCount === 10;

  const score = allAnswered
    ? answers.reduce<number>((sum, val, i) => sum + (QUESTIONS[i].reverse ? 6 - val! : val!), 0)
    : null;

  let verdict = '';
  let verdictColor = '';
  if (score !== null) {
    if (score <= 21) {
      verdict = 'Нет значимой усталости — возможно, просто лень';
      verdictColor = 'var(--color-green)';
    } else if (score <= 34) {
      verdict = 'Есть признаки клинически значимой усталости';
      verdictColor = 'var(--color-accent)';
    } else {
      verdict = 'Выраженная усталость — нужен полноценный отдых';
      verdictColor = 'var(--color-red)';
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 bg-bg-primary flex flex-col"
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <div
            className="flex items-center gap-3 px-4 py-3 shrink-0"
            style={{ boxShadow: NEU.topBar }}
          >
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary transition-colors"
              style={{ boxShadow: NEU.raisedSm }}
            >
              <BackIcon />
            </button>
            <h1 className="text-lg font-bold text-text-primary">Усталость или лень?</h1>
            <span className="ml-auto text-xs text-text-muted">{answeredCount}/10</span>
          </div>

          <div className="flex-1 overflow-auto px-4 py-4 max-w-2xl mx-auto w-full">
            <p className="text-xs text-text-muted mb-4 leading-relaxed">
              Шкала оценки усталости (FAS). Отметьте, как часто вы испытывали каждое из состояний в последнее время.
            </p>

            <div className="flex flex-col gap-3">
              {QUESTIONS.map((q, i) => (
                <div
                  key={i}
                  className="rounded-2xl bg-bg-card p-3"
                  style={{ boxShadow: NEU.raised }}
                >
                  <p className="text-sm text-text-primary mb-2">
                    <span className="text-text-muted mr-1.5">{i + 1}.</span>
                    {q.text}
                  </p>
                  <div className="flex gap-1">
                    {OPTIONS.map((opt) => {
                      const selected = answers[i] === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setAnswer(i, opt.value)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            selected ? 'text-text-primary' : 'text-text-muted'
                          }`}
                          style={{ boxShadow: selected ? NEU.pressedSm : NEU.raisedSm }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {score !== null && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 rounded-2xl bg-bg-card p-4 text-center"
                style={{ boxShadow: NEU.pressed }}
              >
                <p className="text-3xl font-bold mb-1" style={{ color: verdictColor }}>
                  {score}/50
                </p>
                <p className="text-sm text-text-primary font-medium">{verdict}</p>
                <button
                  onClick={() => setAnswers(Array(10).fill(null))}
                  className="mt-3 text-xs text-text-muted hover:text-text-secondary transition-colors"
                >
                  Пройти ещё раз
                </button>
              </motion.div>
            )}

            <p className="text-[10px] text-text-muted/40 mt-4 text-center leading-relaxed pb-4">
              На основе: Бикбулатова Л.Ф., Кутлубаев М.А., Ахмадеева Л.Р. (2012)
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
