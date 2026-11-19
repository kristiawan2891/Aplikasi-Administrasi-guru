import type {
  GradeComponent,
  LearningObjectiveTP,
  Student,
  StudentGrade,
} from '../types/domain';

export interface WeightValidationResult {
  totalWeight: number;
  isValid: boolean;
  message: string;
}

export function validateGradeWeights(
  components: GradeComponent[]
): WeightValidationResult {
  if (components.length === 0) {
    return {
      totalWeight: 0,
      isValid: false,
      message: 'Belum ada komponen penilaian yang ditetapkan.',
    };
  }
  const totalWeight = components.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);
  if (Math.abs(totalWeight - 100) > 0.01) {
    return {
      totalWeight,
      isValid: false,
      message: `Total bobot komponen penilaian saat ini ${totalWeight}%. Total bobot harus tepat 100% sebelum nilai akhir dihitung.`,
    };
  }
  return {
    totalWeight: 100,
    isValid: true,
    message: 'Total bobot valid (100%).',
  };
}

export interface StudentGradeSummary {
  student: Student;
  componentScores: Record<string, number | null>;
  finalScore: number | null;
  status: 'Tuntas' | 'Perlu Remedial' | 'Belum Lengkap';
  filledComponentsCount: number;
  totalComponentsCount: number;
  achievedTpIds: string[];
  developingTpIds: string[];
}

export interface ClassGradeAnalytics {
  weightValidation: WeightValidationResult;
  studentSummaries: StudentGradeSummary[];
  classAverage: number | null;
  highestScore: number | null;
  lowestScore: number | null;
  tuntasCount: number;
  remedialCount: number;
  incompleteCount: number;
  passPercentage: number;
  distribution: {
    '90-100': number;
    '80-89': number;
    '70-79': number;
    '<70': number;
  };
  tpMastery: Array<{
    tp: LearningObjectiveTP;
    averageScore: number | null;
    masteredCount: number;
    evaluatedCount: number;
    masteryRate: number;
  }>;
}

export function computeClassGradeAnalytics(params: {
  students: Student[];
  components: GradeComponent[];
  grades: StudentGrade[];
  tps: LearningObjectiveTP[];
  kktpThreshold: number;
}): ClassGradeAnalytics {
  const { students, components, grades, tps, kktpThreshold } = params;
  const weightValidation = validateGradeWeights(components);

  const studentSummaries: StudentGradeSummary[] = students.map((student) => {
    const studentRows = grades.filter((g) => g.studentId === student.id);
    const componentScores: Record<string, number | null> = {};
    let filledCount = 0;

    for (const comp of components) {
      const matching = studentRows.filter(
        (r) => r.componentId === comp.id && r.score !== null && !Number.isNaN(r.score)
      );
      if (matching.length > 0) {
        const avg =
          matching.reduce((acc, r) => acc + Number(r.score), 0) / matching.length;
        componentScores[comp.id] = Math.round(avg * 100) / 100;
        filledCount += 1;
      } else {
        componentScores[comp.id] = null;
      }
    }

    let finalScore: number | null = null;
    if (weightValidation.isValid && filledCount > 0) {
      // Calculate weighted score across filled components or full formula
      let weightedSum = 0;
      let usedWeight = 0;
      for (const comp of components) {
        const sc = componentScores[comp.id];
        if (sc !== null) {
          weightedSum += sc * (comp.weight / 100);
          usedWeight += comp.weight;
        }
      }
      if (usedWeight === 100) {
        finalScore = Math.round(weightedSum * 100) / 100;
      } else if (usedWeight > 0) {
        // Normalize only if partially filled, or keep strict? Let's be transparent:
        // Only produce final score when all weighted components are filled, OR show proportional?
        // Wait: prompt says "Jika bobot tidak 100%, berikan peringatan dan jangan menghitung nilai akhir secara diam-diam."
        // If weight === 100% and at least 1 score exists, if all components are filled compute exact; if partial, wait until complete or compute weighted sum only if all components with weight > 0 have scores.
        const allWeightedFilled = components
          .filter((c) => c.weight > 0)
          .every((c) => componentScores[c.id] !== null);
        if (allWeightedFilled) {
          finalScore = Math.round(weightedSum * 100) / 100;
        }
      }
    }

    const achievedTpIds: string[] = [];
    const developingTpIds: string[] = [];

    for (const tp of tps) {
      const tpScores = studentRows.filter(
        (r) => r.tpId === tp.id && r.score !== null
      );
      if (tpScores.length > 0) {
        const tpAvg =
          tpScores.reduce((s, r) => s + Number(r.score), 0) / tpScores.length;
        if (tpAvg >= kktpThreshold) {
          achievedTpIds.push(tp.id);
        } else {
          developingTpIds.push(tp.id);
        }
      }
    }

    const status: StudentGradeSummary['status'] =
      finalScore === null
        ? 'Belum Lengkap'
        : finalScore >= kktpThreshold
          ? 'Tuntas'
          : 'Perlu Remedial';

    return {
      student,
      componentScores,
      finalScore,
      status,
      filledComponentsCount: filledCount,
      totalComponentsCount: components.length,
      achievedTpIds,
      developingTpIds,
    };
  });

  const validFinals = studentSummaries
    .map((s) => s.finalScore)
    .filter((v): v is number => v !== null);

  const classAverage =
    validFinals.length > 0
      ? Math.round(
          (validFinals.reduce((a, b) => a + b, 0) / validFinals.length) * 100
        ) / 100
      : null;

  const highestScore = validFinals.length > 0 ? Math.max(...validFinals) : null;
  const lowestScore = validFinals.length > 0 ? Math.min(...validFinals) : null;

  const tuntasCount = studentSummaries.filter((s) => s.status === 'Tuntas').length;
  const remedialCount = studentSummaries.filter(
    (s) => s.status === 'Perlu Remedial'
  ).length;
  const incompleteCount = studentSummaries.filter(
    (s) => s.status === 'Belum Lengkap'
  ).length;

  const passPercentage =
    validFinals.length > 0
      ? Math.round((tuntasCount / validFinals.length) * 1000) / 10
      : 0;

  const distribution = {
    '90-100': validFinals.filter((v) => v >= 90).length,
    '80-89': validFinals.filter((v) => v >= 80 && v < 90).length,
    '70-79': validFinals.filter((v) => v >= 70 && v < 80).length,
    '<70': validFinals.filter((v) => v < 70).length,
  };

  const tpMastery = tps.map((tp) => {
    const tpRows = grades.filter((g) => g.tpId === tp.id && g.score !== null);
    const byStudent = new Map<string, number[]>();
    for (const r of tpRows) {
      const arr = byStudent.get(r.studentId) ?? [];
      arr.push(Number(r.score));
      byStudent.set(r.studentId, arr);
    }
    const studentAvgs = Array.from(byStudent.values()).map(
      (arr) => arr.reduce((a, b) => a + b, 0) / arr.length
    );
    const averageScore =
      studentAvgs.length > 0
        ? Math.round(
            (studentAvgs.reduce((a, b) => a + b, 0) / studentAvgs.length) * 100
          ) / 100
        : null;
    const masteredCount = studentAvgs.filter((v) => v >= kktpThreshold).length;
    const evaluatedCount = studentAvgs.length;
    const masteryRate =
      evaluatedCount > 0 ? Math.round((masteredCount / evaluatedCount) * 100) : 0;

    return {
      tp,
      averageScore,
      masteredCount,
      evaluatedCount,
      masteryRate,
    };
  });

  return {
    weightValidation,
    studentSummaries,
    classAverage,
    highestScore,
    lowestScore,
    tuntasCount,
    remedialCount,
    incompleteCount,
    passPercentage,
    distribution,
    tpMastery,
  };
}
