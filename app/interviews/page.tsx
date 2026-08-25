'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { PageTooltip } from '@/components/onboarding/page-tooltip'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useReactToPrint } from 'react-to-print'

// ── Types ──────────────────────────────────────────────────────────────────────

type QuestionType = 'behavioral' | 'motivational' | 'weakness' | 'hypothetical' | 'introduction' | 'ai_related' | 'general'
type Framework = 'STAR' | 'WHY_WHAT_HOW' | 'DIRECT' | 'SPAR' | 'PST' | 'OPINION'
type SuitableFor = 'fresh_graduate' | 'career_change_same_industry' | 'career_change_cross_industry' | 'promotion_manager' | 'returning' | 'general'

interface Question {
  id: string; question: string; questionEn?: string
  type: 'behavioral' | 'technical' | 'situational' | 'general'
  question_type?: QuestionType
  suitable_for?: string[]
  framework?: Framework
  userAnswer?: string; aiFeedback?: string; aiScore?: number
  strengths?: string[]; suggestions?: string[]; optimizedAnswer?: string
  followUpQ?: string; followUpAnswer?: string
  weaknessLabels?: string[]; improved?: boolean
  contentScore?: number; structureScore?: number; persuasionScore?: number; starHints?: string
}
interface BilingualResult {
  translation: string
  tips: { phrase: string; usage: string; example: string }[]
  editedTranslation?: string
  isEditing?: boolean
}
type InterviewerStyle = 'friendly' | 'strict' | 'technical' | 'hr'
type InterviewMode = 'practice' | 'simulation'
interface SummaryReport {
  avgScore: number
  questionScores: { idx: number; score: number; type: string }[]
  bestType: string; worstType: string
  overallSuggestions: string[]
  dimensions: { content: number; clarity: number; concrete: number; star: number }
}
interface QAQuestion {
  zh: string; en: string; type: 'behavioral' | 'technical' | 'situational' | 'general'
}
interface SessionQuestion {
  id: string; question: string; questionEn?: string
  type: 'behavioral' | 'technical' | 'situational' | 'general'
  userAnswer?: string; aiScore?: number; aiFeedback?: string
}
interface InterviewSession {
  id: string; jobTitle: string; company?: string; language: string
  questions: SessionQuestion[]; createdAt: string; updatedAt: string
}
interface RealRecord {
  id: string; question: string; answer: string; score?: number; feedback?: string; date: string
  interview_date?: string; company?: string; title?: string
}
interface BookmarkedQuestion {
  id: string; question: string; questionEn?: string
  type: 'behavioral' | 'technical' | 'situational' | 'general'
  question_type?: QuestionType; framework?: Framework
  userAnswer: string; aiScore?: number; aiFeedback?: string
  strengths?: string[]; suggestions?: string[]; optimizedAnswer?: string
  savedAt: string; fromRole?: string
}
interface PracticeResult {
  answer: string; score: number
  strengths: string[]; suggestions: string[]; optimizedAnswer: string
}

const TYPE: Record<string, { label: string; labelEn: string; color: 'info' | 'warning' | 'success' | 'default' }> = {
  behavioral:  { label: '行為面試', labelEn: 'Behavioral',  color: 'info' },
  technical:   { label: '技術面試', labelEn: 'Technical',   color: 'warning' },
  situational: { label: '情境題',   labelEn: 'Situational', color: 'success' },
  general:     { label: '一般題',   labelEn: 'General',     color: 'default' },
}

const QA_BANK: { category: string; questions: QAQuestion[] }[] = [
  { category: '通用', questions: [
    { zh: '請簡單介紹你自己，以及你為什麼想應徵這個職位。', en: 'Please introduce yourself and explain why you are applying for this position.', type: 'general' },
    { zh: '你最大的優點和缺點各是什麼？', en: 'What are your greatest strengths and weaknesses?', type: 'general' },
    { zh: '五年後你希望在職業上達到什麼目標？', en: 'Where do you see yourself professionally in 5 years?', type: 'situational' },
    { zh: '描述一次你與同事意見不合的處理方式。', en: 'Describe a time you disagreed with a colleague and how you handled it.', type: 'behavioral' },
    { zh: '描述一次你在工作中犯了錯誤的經驗，你如何處理？', en: 'Describe a time you made a mistake at work and how you handled it.', type: 'behavioral' },
    { zh: '如果你的工作量超過負荷，你會如何應對？', en: 'How do you handle it when your workload exceeds your capacity?', type: 'situational' },
    { zh: '描述一次你在沒有明確指示下主動解決問題的經驗。', en: 'Describe a time you proactively solved a problem without clear guidance.', type: 'behavioral' },
    { zh: '你如何在有壓力的情況下保持高效工作？', en: 'How do you stay productive under pressure?', type: 'behavioral' },
    { zh: '描述一次你說服他人接受你的想法的經驗。', en: 'Describe a time you persuaded others to accept your idea.', type: 'behavioral' },
    { zh: '為什麼你想離開現在的工作？', en: 'Why do you want to leave your current job?', type: 'general' },
    { zh: '如果你發現主管做了一個錯誤的決策，你會怎麼處理？', en: 'What would you do if you discovered your manager made an incorrect decision?', type: 'situational' },
    { zh: '描述一次你在團隊合作中遇到困難的經驗，你如何克服？', en: 'Describe a time you faced challenges in teamwork and how you overcame them.', type: 'behavioral' },
    { zh: '你的薪資期望是多少？', en: 'What are your salary expectations?', type: 'general' },
    { zh: '描述一次你快速學習新技能以應對工作需求的經驗。', en: 'Describe a time you quickly learned a new skill to meet job requirements.', type: 'behavioral' },
    { zh: '如果你同時有多個緊急任務，你如何安排優先順序？', en: 'If you have multiple urgent tasks simultaneously, how do you prioritize?', type: 'situational' },
    { zh: '你如何與不同工作風格的同事合作？', en: 'How do you work with colleagues who have different working styles?', type: 'behavioral' },
    { zh: '如果客戶對你的工作不滿意，你會如何應對？', en: 'How would you handle a situation where a client is dissatisfied with your work?', type: 'situational' },
    { zh: '你對我們公司有什麼了解？', en: 'What do you know about our company?', type: 'general' },
    { zh: '描述一次你達成超出預期目標的經驗。', en: 'Describe a time you exceeded your goals.', type: 'behavioral' },
    { zh: '如果你發現同事的工作有問題，你會如何處理？', en: "What would you do if you noticed a problem with a colleague's work?", type: 'situational' },
  ]},
  { category: '工程師', questions: [
    { zh: '請描述一個你解決過的技術難題，你是如何找到解決方案的？', en: 'Describe a technical challenge you solved. How did you find the solution?', type: 'behavioral' },
    { zh: '你如何確保程式碼品質？', en: 'How do you ensure code quality?', type: 'technical' },
    { zh: '描述一次你在 deadline 壓力下完成專案的經驗。', en: 'Describe a time you completed a project under deadline pressure.', type: 'behavioral' },
    { zh: '說說你最熟悉的系統架構設計原則。', en: 'Describe the system architecture principles you are most familiar with.', type: 'technical' },
    { zh: '請解釋你對 RESTful API 設計原則的理解。', en: 'Please explain your understanding of RESTful API design principles.', type: 'technical' },
    { zh: '描述一次你優化了系統效能的經驗，結果是什麼？', en: 'Describe a time you optimized system performance. What were the results?', type: 'behavioral' },
    { zh: '你如何進行程式碼審查（Code Review）？', en: 'How do you conduct code reviews?', type: 'technical' },
    { zh: '如果你接手一個沒有文件的舊系統，你會怎麼做？', en: 'What would you do if you took over a legacy system with no documentation?', type: 'situational' },
    { zh: '解釋你最熟悉的資料結構和演算法，並舉一個應用例子。', en: 'Explain your most familiar data structures and algorithms with an application example.', type: 'technical' },
    { zh: '描述一次你與非技術背景的人溝通技術問題的經驗。', en: 'Describe a time you communicated technical issues to non-technical stakeholders.', type: 'behavioral' },
    { zh: '你是如何保持對最新技術趨勢的了解的？', en: 'How do you stay updated with the latest technology trends?', type: 'technical' },
    { zh: '如果產品上線後發現嚴重 bug，你的處理流程是什麼？', en: 'What is your process if a critical bug is discovered after a product goes live?', type: 'situational' },
    { zh: '解釋你對微服務架構的理解及其優缺點。', en: 'Explain your understanding of microservices architecture and its pros and cons.', type: 'technical' },
    { zh: '描述一次你主導技術重構的經驗，面對了哪些挑戰？', en: 'Describe a time you led a technical refactoring. What challenges did you face?', type: 'behavioral' },
    { zh: '你如何設計一個可擴展的資料庫架構？', en: 'How do you design a scalable database architecture?', type: 'technical' },
    { zh: '如果你與另一位工程師對技術方案有嚴重分歧，你如何處理？', en: 'How do you handle a serious technical disagreement with another engineer?', type: 'situational' },
    { zh: '解釋你對 CI/CD 的理解和實踐。', en: 'Explain your understanding and practice of CI/CD.', type: 'technical' },
    { zh: '描述一次你指導初級工程師的經驗，你採用了什麼方法？', en: 'Describe a time you mentored a junior engineer. What approach did you use?', type: 'behavioral' },
    { zh: '你如何確保系統的資訊安全？', en: 'How do you ensure information security of a system?', type: 'technical' },
    { zh: '如果你被要求在不熟悉的技術棧上開發功能，你會怎麼做？', en: 'What would you do if asked to develop a feature in an unfamiliar tech stack?', type: 'situational' },
  ]},
  { category: '產品經理', questions: [
    { zh: '你如何決定產品功能的優先順序？', en: 'How do you prioritize product features?', type: 'technical' },
    { zh: '描述一個你主導的功能從想法到上線的過程。', en: 'Describe a feature you led from idea to launch.', type: 'behavioral' },
    { zh: '當工程師認為功能無法如期完成，你如何處理？', en: "What do you do when engineers say a feature can't be delivered on time?", type: 'situational' },
    { zh: '指標下滑時你的排查流程是什麼？', en: 'What is your process when key metrics decline?', type: 'technical' },
    { zh: '描述一次你透過數據發現並解決產品問題的經驗。', en: 'Describe a time you discovered and solved a product problem through data.', type: 'behavioral' },
    { zh: '如果用戶的需求與公司策略方向衝突，你如何處理？', en: 'How do you handle conflicts between user needs and company strategy?', type: 'situational' },
    { zh: '你如何定義和衡量產品的成功指標（KPI）？', en: 'How do you define and measure product success metrics (KPIs)?', type: 'technical' },
    { zh: '描述一次你進行用戶研究並影響產品決策的經驗。', en: 'Describe a time user research influenced your product decisions.', type: 'behavioral' },
    { zh: '如果你必須在兩個功能之間做選擇，資源只夠做一個，你如何決策？', en: 'If you must choose between two features with resources for only one, how do you decide?', type: 'situational' },
    { zh: '你如何撰寫一份有效的 PRD（產品需求文件）？', en: 'How do you write an effective PRD (Product Requirements Document)?', type: 'technical' },
    { zh: '描述一次你在沒有完整資訊的情況下做出產品決策的經驗。', en: 'Describe a time you made a product decision with incomplete information.', type: 'behavioral' },
    { zh: '如果市場上出現了強力的競爭對手，你會如何調整產品策略？', en: 'How would you adjust your product strategy if a strong competitor emerged?', type: 'situational' },
    { zh: '描述一次你成功說服工程師或設計師改變方向的經驗。', en: 'Describe a time you successfully persuaded engineers or designers to change direction.', type: 'behavioral' },
    { zh: '你如何進行競品分析？', en: 'How do you conduct competitive analysis?', type: 'technical' },
    { zh: '描述一次產品失敗的經驗，你從中學到了什麼？', en: 'Describe a product failure experience. What did you learn from it?', type: 'behavioral' },
    { zh: '如果用戶反饋和數據給出了相反的信號，你會以哪個為準？', en: 'If user feedback and data give conflicting signals, which do you prioritize?', type: 'situational' },
    { zh: '你如何設計並執行 A/B 測試？', en: 'How do you design and execute A/B tests?', type: 'technical' },
    { zh: '描述一次你在跨部門合作中遇到挑戰的經驗。', en: 'Describe a time you faced challenges in cross-functional collaboration.', type: 'behavioral' },
    { zh: '如果有用戶抱怨某功能難用，但數據顯示這功能使用率很高，你怎麼做？', en: 'If users complain a feature is difficult to use but data shows high usage, what do you do?', type: 'situational' },
    { zh: '你如何管理產品 Roadmap？', en: 'How do you manage a product roadmap?', type: 'technical' },
  ]},
  { category: '行銷', questions: [
    { zh: '描述一次你負責的行銷活動，從規劃到執行的全過程。', en: 'Describe a marketing campaign you managed from planning to execution.', type: 'behavioral' },
    { zh: '你如何衡量一個行銷活動的成效？', en: 'How do you measure the effectiveness of a marketing campaign?', type: 'technical' },
    { zh: '描述一次你在有限預算下達到行銷目標的經驗。', en: 'Describe a time you achieved marketing goals with a limited budget.', type: 'behavioral' },
    { zh: '你如何制定內容行銷策略？', en: 'How do you develop a content marketing strategy?', type: 'technical' },
    { zh: '描述一次你透過數據分析改善行銷結果的經驗。', en: 'Describe a time you improved marketing results through data analysis.', type: 'behavioral' },
    { zh: '如果一個行銷活動的效果不如預期，你會如何應對？', en: 'How would you respond if a marketing campaign underperforms?', type: 'situational' },
    { zh: '你如何分析目標受眾並建立 Persona？', en: 'How do you analyze target audiences and build personas?', type: 'technical' },
    { zh: '描述一次你成功打造品牌知名度的行銷案例。', en: 'Describe a marketing case where you successfully built brand awareness.', type: 'behavioral' },
    { zh: '如果公司品牌發生負面事件，你會如何進行危機公關？', en: 'How would you handle PR crisis if a negative event hit the company brand?', type: 'situational' },
    { zh: '解釋你對 SEO/SEM 的理解和實踐策略。', en: 'Explain your understanding and strategy for SEO/SEM.', type: 'technical' },
    { zh: '描述一次你與設計或產品團隊合作完成行銷項目的經驗。', en: 'Describe a time you collaborated with design or product teams on a marketing project.', type: 'behavioral' },
    { zh: '你如何利用社群媒體制定和執行行銷計畫？', en: 'How do you use social media to develop and execute marketing plans?', type: 'technical' },
    { zh: '描述一次你管理多個行銷渠道的經驗，你如何協調資源？', en: 'Describe a time you managed multiple marketing channels. How did you coordinate resources?', type: 'behavioral' },
    { zh: '如果需要在短時間內推出一個新產品，你的行銷策略是什麼？', en: 'What is your marketing strategy if you need to launch a new product in a short time?', type: 'situational' },
    { zh: '你如何利用數據進行受眾分群和個性化行銷？', en: 'How do you use data for audience segmentation and personalized marketing?', type: 'technical' },
    { zh: '描述一次你主導 KOL 或品牌合作的經驗。', en: 'Describe a time you led a KOL or brand partnership.', type: 'behavioral' },
    { zh: '如果競品推出了比你們更優惠的促銷活動，你會如何回應？', en: 'How would you respond if competitors launched a better promotional campaign than yours?', type: 'situational' },
    { zh: '解釋你對電子郵件行銷最佳實踐的理解。', en: 'Explain your understanding of email marketing best practices.', type: 'technical' },
    { zh: '描述一次你成功留住流失客戶的行銷策略。', en: 'Describe a marketing strategy that successfully retained churning customers.', type: 'behavioral' },
    { zh: '如果公司要進入一個全新市場，你如何規劃行銷策略？', en: 'How would you plan a marketing strategy if the company enters a completely new market?', type: 'situational' },
  ]},
  { category: '業務', questions: [
    { zh: '描述你最成功的一次銷售案例。', en: 'Describe your most successful sales case.', type: 'behavioral' },
    { zh: '你的銷售流程是什麼？', en: 'What is your sales process?', type: 'technical' },
    { zh: '描述一次你面對客戶拒絕後如何轉化成功的經驗。', en: 'Describe a time you turned a client rejection into a successful conversion.', type: 'behavioral' },
    { zh: '如果你的銷售目標遠高於現有客戶能提供的業績，你會怎麼做？', en: 'What would you do if your sales target far exceeds what current clients can provide?', type: 'situational' },
    { zh: '描述一次你管理複雜銷售週期的經驗。', en: 'Describe a time you managed a complex sales cycle.', type: 'behavioral' },
    { zh: '你如何識別並接觸潛在客戶（Lead Generation）？', en: 'How do you identify and approach potential clients (Lead Generation)?', type: 'technical' },
    { zh: '描述一次你與困難客戶建立長期關係的經驗。', en: 'Describe a time you built a long-term relationship with a difficult client.', type: 'behavioral' },
    { zh: '如果客戶要求你提供超出你授權範圍的折扣，你會如何應對？', en: 'How would you handle a client requesting a discount beyond your authorization?', type: 'situational' },
    { zh: '你如何使用 CRM 工具管理客戶關係？', en: 'How do you use CRM tools to manage client relationships?', type: 'technical' },
    { zh: '描述一次你超越銷售配額的經驗，你使用了什麼策略？', en: 'Describe a time you exceeded your sales quota. What strategies did you use?', type: 'behavioral' },
    { zh: '如果你發現客戶可能適合更低價的方案，你會怎麼做？', en: 'What would you do if you realize a client might be better served by a cheaper solution?', type: 'situational' },
    { zh: '你如何進行競品差異化的銷售話術？', en: 'How do you craft sales pitches that differentiate from competitors?', type: 'technical' },
    { zh: '描述一次你在銷售過程中遇到道德兩難的處理方式。', en: 'Describe a time you encountered ethical dilemmas in the sales process.', type: 'behavioral' },
    { zh: '如果你的主要客戶突然說要換競爭對手，你會如何挽留？', en: 'How would you retain a key client who suddenly says they want to switch to a competitor?', type: 'situational' },
    { zh: '解釋你對 B2B 和 B2C 銷售策略差異的理解。', en: 'Explain your understanding of differences between B2B and B2C sales strategies.', type: 'technical' },
    { zh: '描述一次你成功完成大型企業客戶（Key Account）的開發。', en: 'Describe a time you successfully acquired a major enterprise client (Key Account).', type: 'behavioral' },
    { zh: '如果你接管了一個業績不佳的客戶組合，你的第一步是什麼？', en: 'If you take over an underperforming client portfolio, what is your first step?', type: 'situational' },
    { zh: '你如何分析銷售數據來改善業績？', en: 'How do you analyze sales data to improve performance?', type: 'technical' },
    { zh: '描述一次你與跨部門團隊合作完成大型案子的經驗。', en: 'Describe a time you collaborated with cross-functional teams to close a major deal.', type: 'behavioral' },
    { zh: '如果在合約簽署前，客戶對產品提出嚴重質疑，你如何處理？', en: 'How would you handle a client raising serious doubts about your product just before signing a contract?', type: 'situational' },
  ]},
  { category: '人資', questions: [
    { zh: '描述一次你成功招聘到關鍵人才的經驗。', en: 'Describe a time you successfully recruited a key talent.', type: 'behavioral' },
    { zh: '你如何設計一套有效的績效評估系統？', en: 'How do you design an effective performance evaluation system?', type: 'technical' },
    { zh: '描述一次你處理員工衝突的經驗，你是如何解決的？', en: 'Describe a time you handled an employee conflict. How did you resolve it?', type: 'behavioral' },
    { zh: '如果一位高績效員工突然提出辭職，你會如何應對？', en: 'How would you respond if a high-performing employee suddenly submits their resignation?', type: 'situational' },
    { zh: '你如何設計有競爭力的薪資福利方案？', en: 'How do you design a competitive compensation and benefits package?', type: 'technical' },
    { zh: '描述一次你推動公司文化改變的經驗。', en: 'Describe a time you drove a change in company culture.', type: 'behavioral' },
    { zh: '如果你發現某個部門的離職率很高，你會如何排查原因？', en: 'If you discover high turnover in a department, how would you investigate the cause?', type: 'situational' },
    { zh: '你如何設計新員工入職（Onboarding）流程？', en: 'How do you design an effective employee onboarding process?', type: 'technical' },
    { zh: '描述一次你在法規限制下平衡員工權益與公司需求的經驗。', en: 'Describe a time you balanced employee rights and company needs within legal constraints.', type: 'behavioral' },
    { zh: '如果公司要進行大規模裁員，你作為人資會如何規劃和執行？', en: 'If the company needs to conduct large-scale layoffs, how would you plan and execute as HR?', type: 'situational' },
    { zh: '你如何設計員工培訓和職涯發展計畫？', en: 'How do you design employee training and career development plans?', type: 'technical' },
    { zh: '描述一次你主導員工敬業度提升計畫的經驗。', en: 'Describe a time you led an employee engagement improvement initiative.', type: 'behavioral' },
    { zh: '如果有員工舉報職場霸凌，你的調查流程是什麼？', en: 'What is your investigation process if an employee reports workplace bullying?', type: 'situational' },
    { zh: '你如何利用 HR 數據分析改善人力資源決策？', en: 'How do you use people analytics to improve HR decisions?', type: 'technical' },
    { zh: '描述一次你成功改善部門招募時效的經驗。', en: 'Describe a time you successfully improved hiring time-to-fill.', type: 'behavioral' },
    { zh: '如果高管與員工對某項政策有嚴重分歧，你如何從中調解？', en: 'How would you mediate if executives and employees have serious disagreements about a policy?', type: 'situational' },
    { zh: '你如何確保公司招募流程的公平性和多元包容性（DEI）？', en: 'How do you ensure fairness and DEI in the recruitment process?', type: 'technical' },
    { zh: '描述一次你在有限資源下完成大型招募任務的經驗。', en: 'Describe a time you completed a large-scale recruitment task with limited resources.', type: 'behavioral' },
    { zh: '如果有員工投訴薪資不公平，你如何進行調查和處理？', en: 'How would you investigate and handle an employee complaint about pay inequity?', type: 'situational' },
    { zh: '解釋你對勞動法規遵從（Labor Compliance）的理解及其實踐。', en: 'Explain your understanding of labor law compliance and how you practice it.', type: 'technical' },
  ]},
  { category: '財務', questions: [
    { zh: '解釋你對三大財務報表（損益表、資產負債表、現金流量表）的理解和關聯。', en: 'Explain your understanding of the three financial statements and their relationships.', type: 'technical' },
    { zh: '描述一次你發現財務異常並成功排查的經驗。', en: 'Describe a time you identified a financial anomaly and successfully investigated it.', type: 'behavioral' },
    { zh: '你如何進行財務預測和建立財務模型？', en: 'How do you conduct financial forecasting and build financial models?', type: 'technical' },
    { zh: '如果公司現金流突然出現嚴重短缺，你作為財務人員的應對措施是什麼？', en: 'If the company suddenly faces a serious cash flow shortage, what are your measures as a finance professional?', type: 'situational' },
    { zh: '解釋你對 EBITDA 和自由現金流的理解及其意義。', en: 'Explain your understanding of EBITDA and free cash flow and their significance.', type: 'technical' },
    { zh: '描述一次你主導預算規劃並成功控制成本的經驗。', en: 'Describe a time you led budget planning and successfully controlled costs.', type: 'behavioral' },
    { zh: '如果業務部門的預算申請遠超出合理範圍，你如何拒絕並協商？', en: "How would you decline and negotiate if a business department's budget request is far beyond reasonable?", type: 'situational' },
    { zh: '你如何進行企業估值（Valuation）？', en: 'How do you conduct company valuation?', type: 'technical' },
    { zh: '描述一次你協助公司做出重要財務決策的經驗。', en: 'Describe a time you helped the company make an important financial decision.', type: 'behavioral' },
    { zh: '解釋你對稅務規劃和合規的理解。', en: 'Explain your understanding of tax planning and compliance.', type: 'technical' },
    { zh: '如果你發現有部門存在財務舞弊的跡象，你會如何處理？', en: 'How would you handle a situation where you discover signs of financial fraud in a department?', type: 'situational' },
    { zh: '描述一次你向非財務背景的管理層解釋複雜財務概念的經驗。', en: 'Describe a time you explained complex financial concepts to non-financial management.', type: 'behavioral' },
    { zh: '你如何進行資本支出（CapEx）分析和決策？', en: 'How do you analyze and make decisions on capital expenditure (CapEx)?', type: 'technical' },
    { zh: '如果公司計劃進行併購，你在財務盡職調查中的角色和流程是什麼？', en: 'What is your role and process in financial due diligence if the company plans an M&A?', type: 'situational' },
    { zh: '解釋你對 Working Capital Management 的理解和優化策略。', en: 'Explain your understanding of working capital management and optimization strategies.', type: 'technical' },
    { zh: '描述一次你改善公司財務報告流程的經驗。', en: "Describe a time you improved the company's financial reporting process.", type: 'behavioral' },
    { zh: '如果利率大幅上升影響公司融資成本，你有哪些風險管控策略？', en: 'What risk management strategies do you have if interest rates rise significantly affecting financing costs?', type: 'situational' },
    { zh: '你如何設計並監控關鍵財務 KPI？', en: 'How do you design and monitor key financial KPIs?', type: 'technical' },
    { zh: '描述一次你在資金緊張時期協助公司優化現金流的經驗。', en: 'Describe a time you helped the company optimize cash flow during a tight period.', type: 'behavioral' },
    { zh: '如果你的財務分析與業務部門的預估有重大差異，你如何處理？', en: "How would you handle a major discrepancy between your financial analysis and the business team's projections?", type: 'situational' },
  ]},
  { category: '設計', questions: [
    { zh: '請介紹一個你最引以為傲的設計專案，從挑戰到解決方案。', en: 'Please introduce a design project you are most proud of, from challenge to solution.', type: 'behavioral' },
    { zh: '解釋你的設計流程，從研究到最終交付。', en: 'Explain your design process from research to final delivery.', type: 'technical' },
    { zh: '描述一次你收到與自己設計理念截然不同反饋的經驗，你如何應對？', en: 'Describe a time you received feedback completely different from your design philosophy. How did you respond?', type: 'behavioral' },
    { zh: '如果利害關係人要求的設計方向在用戶研究上缺乏依據，你如何說服他們？', en: 'How do you persuade stakeholders if their requested design direction lacks user research support?', type: 'situational' },
    { zh: '你如何進行用戶研究（UX Research）並將發現融入設計？', en: 'How do you conduct UX research and incorporate findings into design?', type: 'technical' },
    { zh: '描述一次你在時間和資源有限的情況下完成設計的經驗。', en: 'Describe a time you completed a design with limited time and resources.', type: 'behavioral' },
    { zh: '解釋你對設計系統（Design System）的理解和建立方法。', en: 'Explain your understanding of design systems and how to build them.', type: 'technical' },
    { zh: '如果工程師告訴你某個設計在技術上難以實現，你會如何處理？', en: 'How would you handle it if an engineer tells you a design is technically difficult to implement?', type: 'situational' },
    { zh: '你如何確保你的設計符合無障礙設計（Accessibility）標準？', en: 'How do you ensure your designs meet accessibility standards?', type: 'technical' },
    { zh: '描述一次你透過設計改善關鍵業務指標的經驗。', en: 'Describe a time your design improved key business metrics.', type: 'behavioral' },
    { zh: '如果你需要在美觀與可用性之間做出取捨，你的考量是什麼？', en: 'What is your consideration when making trade-offs between aesthetics and usability?', type: 'situational' },
    { zh: '你如何進行 Usability Testing 並迭代改善設計？', en: 'How do you conduct usability testing and iteratively improve your design?', type: 'technical' },
    { zh: '描述一次你指導初級設計師或建立設計標準的經驗。', en: 'Describe a time you mentored a junior designer or established design standards.', type: 'behavioral' },
    { zh: '如果不同部門的利害關係人對設計方向有分歧，你如何取得共識？', en: 'How do you reach consensus if stakeholders from different departments disagree on design direction?', type: 'situational' },
    { zh: '解釋你對資訊架構（Information Architecture）的理解及設計原則。', en: 'Explain your understanding of information architecture and design principles.', type: 'technical' },
    { zh: '描述一次你透過設計創新解決用戶痛點的經驗。', en: 'Describe a time you solved user pain points through design innovation.', type: 'behavioral' },
    { zh: '如果產品需要針對不同文化市場進行本地化設計，你會如何規劃？', en: 'How would you plan if the product needs localized design for different cultural markets?', type: 'situational' },
    { zh: '你如何使用數據和分析工具驗證設計決策？', en: 'How do you use data and analytics tools to validate design decisions?', type: 'technical' },
    { zh: '描述一次你在跨職能團隊中如何為設計決策辯護的經驗。', en: 'Describe a time you advocated for a design decision in a cross-functional team.', type: 'behavioral' },
    { zh: '如果公司決定重新設計整個產品界面，你如何規劃和推進這個項目？', en: 'How would you plan and drive a complete product interface redesign?', type: 'situational' },
  ]},
  { category: '客服', questions: [
    { zh: '描述一次你成功化解一位非常憤怒的客戶的經驗。', en: 'Describe a time you successfully de-escalated a very angry customer.', type: 'behavioral' },
    { zh: '你如何在服務多位客戶的同時，確保每位都得到及時且高品質的服務？', en: 'How do you ensure timely and high-quality service for each client while serving multiple customers simultaneously?', type: 'technical' },
    { zh: '描述一次你在無法滿足客戶要求的情況下，仍讓客戶感到滿意的經驗。', en: "Describe a time you made a customer satisfied even when you couldn't meet their demands.", type: 'behavioral' },
    { zh: '如果客戶要求超出公司政策範圍的退款或補償，你如何應對？', en: 'How would you respond if a customer demands a refund or compensation beyond company policy?', type: 'situational' },
    { zh: '你如何記錄和追蹤客戶問題，確保每個問題都能被妥善解決？', en: 'How do you document and track customer issues to ensure each is properly resolved?', type: 'technical' },
    { zh: '描述一次你從客戶反饋中發現產品或服務問題，並推動改善的經驗。', en: 'Describe a time you discovered a product or service problem from customer feedback and drove improvement.', type: 'behavioral' },
    { zh: '如果你無法立即解決客戶的問題，你的處理方式是什麼？', en: "What is your approach if you cannot immediately resolve a customer's problem?", type: 'situational' },
    { zh: '你如何衡量客服品質和客戶滿意度（CSAT/NPS）？', en: 'How do you measure customer service quality and satisfaction (CSAT/NPS)?', type: 'technical' },
    { zh: '描述一次你超越客戶期望，提供卓越服務的經驗。', en: 'Describe a time you exceeded customer expectations and delivered exceptional service.', type: 'behavioral' },
    { zh: '如果你同時接到多個緊急客戶投訴，你如何安排處理順序？', en: 'How do you prioritize multiple urgent customer complaints received simultaneously?', type: 'situational' },
    { zh: '你如何利用知識庫和自助服務工具提升客服效率？', en: 'How do you use knowledge bases and self-service tools to improve customer service efficiency?', type: 'technical' },
    { zh: '描述一次你面對情緒激動的客戶，如何保持冷靜並有效溝通的經驗。', en: 'Describe a time you maintained composure and communicated effectively with an emotionally upset customer.', type: 'behavioral' },
    { zh: '如果客戶在社群媒體上公開抱怨產品，你的處理流程是什麼？', en: 'What is your process if a customer publicly complains about the product on social media?', type: 'situational' },
    { zh: '解釋你對客戶旅程地圖（Customer Journey Map）的理解和應用。', en: 'Explain your understanding and application of customer journey mapping.', type: 'technical' },
    { zh: '描述一次你與產品或工程團隊合作解決系統性客戶問題的經驗。', en: 'Describe a time you worked with product or engineering teams to resolve a systemic customer issue.', type: 'behavioral' },
    { zh: '如果公司政策有明顯不合理之處，導致客戶一再抱怨，你會如何推動改變？', en: 'How would you push for policy changes if unreasonable company policies cause recurring customer complaints?', type: 'situational' },
    { zh: '你如何設計和優化客服流程以減少首次回應時間？', en: 'How do you design and optimize customer service processes to reduce first response time?', type: 'technical' },
    { zh: '描述一次你在高壓、高量的工作環境中保持服務品質的經驗。', en: 'Describe a time you maintained service quality in a high-pressure, high-volume work environment.', type: 'behavioral' },
    { zh: '如果新產品上市後引發大量客戶投訴，你如何組織快速回應？', en: 'How would you organize a rapid response if a new product launch triggers massive customer complaints?', type: 'situational' },
    { zh: '你如何建立和培訓一支高效的客服團隊？', en: 'How do you build and train a high-performing customer service team?', type: 'technical' },
  ]},
]

const INTERVIEWER_STYLES: { id: InterviewerStyle; emoji: string; label: string; desc: string; prompt: string }[] = [
  { id: 'friendly',  emoji: '😊', label: '友善型', desc: '引導式提問，氣氛輕鬆，適合練習新手',  prompt: '用鼓勵、友善的語氣提問和追問，適時給予正面回饋' },
  { id: 'strict',    emoji: '🎯', label: '嚴格型', desc: '追問犀利，標準高，模擬高壓面試',       prompt: '用嚴格、直接的語氣，深入追問細節，對模糊回答提出質疑' },
  { id: 'technical', emoji: '💻', label: '技術型', desc: '深入技術細節，適合工程師、數據職位',   prompt: '著重技術細節、系統設計、問題解決邏輯，追問技術決策原因' },
  { id: 'hr',        emoji: '👔', label: 'HR 型',  desc: '著重軟實力、價值觀、文化契合度',       prompt: '著重團隊合作、職涯動機、公司文化契合，追問個人特質和價值觀' },
]

const FRAMEWORK_MAP: Record<QuestionType, Framework> = {
  behavioral:   'STAR',
  motivational: 'WHY_WHAT_HOW',
  weakness:     'DIRECT',
  hypothetical: 'SPAR',
  introduction: 'PST',
  ai_related:   'OPINION',
  general:      'STAR',
}

const FRAMEWORK_HINTS: Record<Framework, { label: string; steps: string[]; tip: string }> = {
  STAR: {
    label: 'STAR 架構',
    steps: ['S — Situation 情境', 'T — Task 任務', 'A — Action 行動', 'R — Result 結果'],
    tip: '以具體數字強化 Result，例如「提升 30% 效率」',
  },
  WHY_WHAT_HOW: {
    label: 'Why → What → How',
    steps: ['Why 為什麼選這個職位／公司', 'What 你能帶來什麼價值', 'How 你的計畫與期待'],
    tip: '誠實回答動機，展現你對這份工作的具體了解',
  },
  DIRECT: {
    label: 'DIRECT 直接法',
    steps: ['D — Declare 直接說出缺點', 'I — Impact 說明影響', 'R — Remediation 改善行動', 'E — Evidence 已改善的證據', 'C — Conclusion 總結成長'],
    tip: '挑選真實但非致命的缺點，重點放在改善行動',
  },
  SPAR: {
    label: 'SPAR 情境分析',
    steps: ['S — Situation 假設情境分析', 'P — Problem 識別核心問題', 'A — Action 行動方案', 'R — Result 預期結果與評估'],
    tip: '先釐清前提與資訊，再提出有邏輯的解決方案',
  },
  PST: {
    label: 'PST 自我介紹',
    steps: ['P — Past 過去背景與經驗', 'S — Skills 核心能力與強項', 'T — Today 為什麼是現在這個職位'],
    tip: '控制在 90-120 秒，結尾呼應此次應徵職位',
  },
  OPINION: {
    label: 'OPINION 觀點法',
    steps: ['O — Opinion 說出你的立場', 'P — Point 主要論點', 'I — Implication 對工作的影響', 'N — Note 補充說明'],
    tip: '展現對 AI 趨勢的思考深度，避免流於表面',
  },
}

const SCENARIOS: { id: SuitableFor; label: string; desc: string }[] = [
  { id: 'fresh_graduate',               label: '應屆畢業生',   desc: '無工作經驗，求第一份正職' },
  { id: 'career_change_same_industry',  label: '同產業換職能', desc: '同業內轉換跑道（如 PM → BD）' },
  { id: 'career_change_cross_industry', label: '跨產業轉職',   desc: '切換到完全不同的產業' },
  { id: 'promotion_manager',            label: '升遷管理職',   desc: '首次或再次擔任管理角色' },
  { id: 'returning',                    label: '職涯重啟',     desc: '空窗一段時間後重返職場' },
  { id: 'general',                      label: '一般求職',     desc: '常規換工作，無特殊情境' },
]

const UNIVERSAL_QUESTIONS: Question[] = [
  { id: 'u01', question: '請簡單介紹你自己，並說明你為什麼適合這個職位。', questionEn: 'Please briefly introduce yourself and explain why you are a good fit for this role.', type: 'general', question_type: 'introduction', suitable_for: ['all'], framework: 'PST' },
  { id: 'u02', question: '你最大的優點是什麼？請舉例說明。', questionEn: 'What is your greatest strength? Please provide an example.', type: 'behavioral', question_type: 'behavioral', suitable_for: ['all'], framework: 'STAR' },
  { id: 'u03', question: '你最大的缺點是什麼？你如何改善它？', questionEn: 'What is your greatest weakness and how do you work to improve it?', type: 'general', question_type: 'weakness', suitable_for: ['all'], framework: 'DIRECT' },
  { id: 'u04', question: '五年後你希望達到什麼職涯目標？', questionEn: 'Where do you see yourself professionally in 5 years?', type: 'situational', question_type: 'motivational', suitable_for: ['all'], framework: 'WHY_WHAT_HOW' },
  { id: 'u05', question: '你為什麼對這個職位感興趣？你對這間公司有什麼了解？', questionEn: 'Why are you interested in this position? What do you know about our company?', type: 'general', question_type: 'motivational', suitable_for: ['all'], framework: 'WHY_WHAT_HOW' },
  { id: 'u06', question: '描述一次你在有壓力的情況下成功完成任務的經驗。', questionEn: 'Describe a time you successfully completed a task under pressure.', type: 'behavioral', question_type: 'behavioral', suitable_for: ['all'], framework: 'STAR' },
  { id: 'u07', question: '你如何看待 AI 工具（如 ChatGPT）對你的工作帶來的影響？', questionEn: 'How do you view the impact of AI tools like ChatGPT on your work?', type: 'general', question_type: 'ai_related', suitable_for: ['all'], framework: 'OPINION' },
  { id: 'u08', question: '你在工作中如何與不同意見的人溝通協作？', questionEn: 'How do you communicate and collaborate with people who have different opinions?', type: 'behavioral', question_type: 'behavioral', suitable_for: ['all'], framework: 'STAR' },
  { id: 'u09', question: '描述一次你主動學習新技能的經驗，為什麼你選擇學習它？', questionEn: 'Describe a time you proactively learned a new skill. Why did you choose to learn it?', type: 'behavioral', question_type: 'behavioral', suitable_for: ['all'], framework: 'STAR' },
  { id: 'u10', question: '如果你同時接到多個任務，你如何安排優先順序？', questionEn: 'If you receive multiple tasks at the same time, how do you prioritize?', type: 'situational', question_type: 'hypothetical', suitable_for: ['all'], framework: 'SPAR' },
  { id: 'u11', question: '你最近使用過哪些 AI 工具？對你的工作效率有什麼影響？', questionEn: 'What AI tools have you used recently? How have they impacted your work efficiency?', type: 'general', question_type: 'ai_related', suitable_for: ['all'], framework: 'OPINION' },
  { id: 'u12', question: '描述一次你失敗的經驗，你從中學到了什麼？', questionEn: 'Describe a failure experience. What did you learn from it?', type: 'behavioral', question_type: 'behavioral', suitable_for: ['all'], framework: 'STAR' },
  { id: 'u13', question: '你如何在工作與生活之間取得平衡？', questionEn: 'How do you maintain work-life balance?', type: 'general', question_type: 'general', suitable_for: ['all'], framework: 'STAR' },
  { id: 'u14', question: '你對於在工作中使用 AI 輔助決策有什麼看法？', questionEn: 'What is your view on using AI to assist decision-making at work?', type: 'general', question_type: 'ai_related', suitable_for: ['all'], framework: 'OPINION' },
  { id: 'u15', question: '描述一次你在沒有完整資訊的情況下做出決策的經驗。', questionEn: 'Describe a time you made a decision without complete information.', type: 'situational', question_type: 'behavioral', suitable_for: ['all'], framework: 'STAR' },
  { id: 'u16', question: '如果你發現工作流程可以改善，你會如何推動變化？', questionEn: 'If you identify a workflow that could be improved, how would you drive the change?', type: 'situational', question_type: 'hypothetical', suitable_for: ['all'], framework: 'SPAR' },
  { id: 'u17', question: '你如何保持在你的專業領域的持續學習？', questionEn: 'How do you maintain continuous learning in your professional field?', type: 'behavioral', question_type: 'behavioral', suitable_for: ['all'], framework: 'STAR' },
  { id: 'u18', question: '描述一次你說服他人接受你想法的經驗。', questionEn: 'Describe a time you convinced others to accept your idea.', type: 'behavioral', question_type: 'behavioral', suitable_for: ['all'], framework: 'STAR' },
  { id: 'u19', question: '如果可以用 AI 自動化你工作中的一個環節，你會選擇哪個？為什麼？', questionEn: 'If you could automate one part of your work with AI, which would you choose? Why?', type: 'general', question_type: 'ai_related', suitable_for: ['all'], framework: 'OPINION' },
  { id: 'u20', question: '你理想的工作環境和文化是什麼？', questionEn: 'What is your ideal work environment and culture?', type: 'general', question_type: 'general', suitable_for: ['all'], framework: 'STAR' },
]

const FALLBACK_QUESTIONS: Partial<Record<SuitableFor, Question[]>> = {
  fresh_graduate: [
    { id: 'fb_fg1', question: '請談談你的畢業專題或實習經驗，以及你從中學到了什麼。', questionEn: 'Tell us about your graduation project or internship and what you learned.', type: 'behavioral', question_type: 'behavioral', suitable_for: ['fresh_graduate'], framework: 'STAR' },
    { id: 'fb_fg2', question: '作為應屆生，你認為自己最能為這個職位貢獻什麼？', questionEn: 'As a fresh graduate, what do you believe you can contribute most to this role?', type: 'general', question_type: 'motivational', suitable_for: ['fresh_graduate'], framework: 'WHY_WHAT_HOW' },
    { id: 'fb_fg3', question: '你在校期間參與過什麼社團活動或課外計畫？這些經驗如何培養你的職場能力？', questionEn: 'What extracurricular activities did you join? How did they build your workplace skills?', type: 'behavioral', question_type: 'behavioral', suitable_for: ['fresh_graduate'], framework: 'STAR' },
  ],
  career_change_same_industry: [
    { id: 'fb_ccs1', question: '你為什麼想在同產業內轉換職能？你對新職能有哪些了解？', questionEn: 'Why do you want to change roles within the same industry? What do you know about the new role?', type: 'general', question_type: 'motivational', suitable_for: ['career_change_same_industry'], framework: 'WHY_WHAT_HOW' },
    { id: 'fb_ccs2', question: '你過去的職能經驗如何支撐你在新職能的發展？', questionEn: 'How does your past role experience support your development in the new role?', type: 'behavioral', question_type: 'behavioral', suitable_for: ['career_change_same_industry'], framework: 'STAR' },
    { id: 'fb_ccs3', question: '轉換職能的過程中你面臨的最大挑戰是什麼？你如何準備應對？', questionEn: 'What is the biggest challenge in transitioning roles? How are you preparing?', type: 'situational', question_type: 'hypothetical', suitable_for: ['career_change_same_industry'], framework: 'SPAR' },
  ],
  career_change_cross_industry: [
    { id: 'fb_cci1', question: '你為什麼決定跨產業轉職？是什麼促使你做出這個決定？', questionEn: 'Why did you decide to change industries? What motivated this decision?', type: 'general', question_type: 'motivational', suitable_for: ['career_change_cross_industry'], framework: 'WHY_WHAT_HOW' },
    { id: 'fb_cci2', question: '你的跨產業背景如何幫助你為新公司帶來不同的視角？', questionEn: 'How does your cross-industry background help you bring a different perspective to the new company?', type: 'behavioral', question_type: 'behavioral', suitable_for: ['career_change_cross_industry'], framework: 'STAR' },
    { id: 'fb_cci3', question: '你對這個新產業的了解深度如何？你是透過什麼方式自學的？', questionEn: 'How deeply do you understand this new industry? How have you self-educated?', type: 'general', question_type: 'motivational', suitable_for: ['career_change_cross_industry'], framework: 'WHY_WHAT_HOW' },
  ],
  promotion_manager: [
    { id: 'fb_pm1', question: '請描述你的管理風格，並舉例說明它如何在你的團隊中發揮效果。', questionEn: 'Describe your management style and give an example of how it works with your team.', type: 'behavioral', question_type: 'behavioral', suitable_for: ['promotion_manager'], framework: 'STAR' },
    { id: 'fb_pm2', question: '你如何激勵績效不佳的員工？請舉具體案例。', questionEn: 'How do you motivate underperforming employees? Please give a specific example.', type: 'behavioral', question_type: 'behavioral', suitable_for: ['promotion_manager'], framework: 'STAR' },
    { id: 'fb_pm3', question: '描述一次你需要做出困難人事決定的經驗，你如何應對？', questionEn: 'Describe a time you had to make a difficult personnel decision and how you handled it.', type: 'behavioral', question_type: 'behavioral', suitable_for: ['promotion_manager'], framework: 'STAR' },
  ],
  returning: [
    { id: 'fb_r1', question: '在職涯空窗期間，你做了哪些事情讓自己保持競爭力或提升技能？', questionEn: 'During your career gap, what did you do to stay competitive or upskill?', type: 'behavioral', question_type: 'behavioral', suitable_for: ['returning'], framework: 'STAR' },
    { id: 'fb_r2', question: '你準備如何重新融入快速變化的職場環境？', questionEn: 'How do you plan to re-integrate into the fast-changing work environment?', type: 'situational', question_type: 'hypothetical', suitable_for: ['returning'], framework: 'SPAR' },
    { id: 'fb_r3', question: '你對重回職場最擔心的是什麼？你如何克服這個顧慮？', questionEn: 'What concerns you most about returning to the workplace? How do you plan to overcome it?', type: 'general', question_type: 'weakness', suitable_for: ['returning'], framework: 'DIRECT' },
  ],
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5) }
const scoreCol   = (s: number) => s >= 8 ? 'text-sage-600' : s >= 5 ? 'text-honey-500' : 'text-terra-500'
const scoreLabel = (s: number) => s >= 8 ? '表現優異' : s >= 6 ? '表現良好' : s >= 4 ? '尚可改善' : '需要加強'
function scoreStars(score: number) {
  const filled = Math.round(score / 2)
  return '★'.repeat(filled) + '☆'.repeat(5 - filled)
}

type SpeechRecognitionCtor = new () => {
  continuous: boolean; interimResults: boolean; lang: string
  start(): void; stop(): void
  onresult: ((event: Event & { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
}
declare global {
  interface Window { SpeechRecognition: SpeechRecognitionCtor; webkitSpeechRecognition: SpeechRecognitionCtor }
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function InterviewPrepPage() {
  const [tab, setTab] = useState<'mock' | 'record' | 'bank'>('mock')

  // Mock interview — session flow
  const [mockStep, setMockStep] = useState<'loading' | 'sessions' | 'setup' | 'list' | 'practice' | 'report'>('loading')
  const [sessions, setSessions]               = useState<InterviewSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [role, setRole]         = useState('')
  const [company, setCompany]   = useState('')
  const [questionCount, setQuestionCount] = useState<10 | 15 | 20>(15)
  const [questions, setQuestions]     = useState<Question[]>([])
  const [generating, setGenerating]   = useState(false)
  const [selectedQ, setSelectedQ]     = useState<Question | null>(null)
  const [mockPracticeIdx, setMockPracticeIdx] = useState(0)
  const [answer, setAnswer]           = useState('')
  const [answerLang, setAnswerLang]   = useState<'zh' | 'en' | 'bilingual'>('bilingual')
  const [evaluating, setEvaluating]   = useState(false)
  const [bilingualData, setBilingualData] = useState<Record<string, BilingualResult>>({})
  const [translating, setTranslating] = useState(false)
  const [showEn, setShowEn]           = useState(false)
  const [showMockOptimized, setShowMockOptimized] = useState(false)

  // Journal-linked mode
  const [journalLinkedQ, setJournalLinkedQ] = useState<string | null>(null)
  const [journalLinkedStar, setJournalLinkedStar] = useState<{situation: string; task: string; action: string; result: string} | null>(null)
  const [journalLinkedFromId, setJournalLinkedFromId] = useState<string | null>(null)
  const [starDraftPanelOpen, setStarDraftPanelOpen] = useState(true)

  // Interviewer style + mode
  const [interviewerStyle, setInterviewerStyle] = useState<InterviewerStyle>('friendly')
  const [interviewMode, setInterviewMode] = useState<InterviewMode>('practice')

  // Timer
  const [timerPhase, setTimerPhase] = useState<'idle' | 'thinking' | 'answering' | 'expired'>('idle')
  const [timerSec, setTimerSec] = useState(0)

  // Follow-up
  const [followUpQ, setFollowUpQ] = useState('')
  const [followUpAnswer, setFollowUpAnswer] = useState('')
  const [followUpStep, setFollowUpStep] = useState<'none' | 'followup' | 'scored'>('none')
  const [generatingFollowUp, setGeneratingFollowUp] = useState(false)

  // Summary report
  const [report, setReport] = useState<SummaryReport | null>(null)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [improvedMap, setImprovedMap] = useState<Record<string, boolean>>({})
  const [expandedReview, setExpandedReview] = useState<Record<string, boolean>>({})

  // Scenario + universal questions
  const [scenario, setScenario] = useState<SuitableFor>('general')
  const [includeUniversal, setIncludeUniversal] = useState(true)

  // QA bank
  const [selectedCat, setSelectedCat]   = useState('通用')
  const [practiceIdx, setPracticeIdx]   = useState(0)
  const [practiceAnswer, setPracticeAnswer] = useState('')
  const [practiceResults, setPracticeResults] = useState<Record<string, PracticeResult>>({})
  const [practiceEval, setPracticeEval] = useState(false)
  const [showOptimized, setShowOptimized] = useState(false)
  const [qaBankLang, setQaBankLang] = useState<'zh' | 'en'>('zh')

  // Real interview record
  const [records, setRecords]         = useState<RealRecord[]>([])
  const [recQuestion, setRecQuestion] = useState('')
  const [recAnswer, setRecAnswer]     = useState('')
  const [recDate, setRecDate]         = useState(() => new Date().toISOString().slice(0, 10))
  const [recCompany, setRecCompany]   = useState('')
  const [recTitle, setRecTitle]       = useState('')
  const [recEvaluating, setRecEvaluating] = useState(false)
  const [trackerCompanies, setTrackerCompanies] = useState<string[]>([])
  const [trackerTitles, setTrackerTitles]       = useState<Record<string, string[]>>({})

  // Personal question bank
  const [bookmarks, setBookmarks]         = useState<BookmarkedQuestion[]>([])
  const [bankTypeFilter, setBankTypeFilter] = useState<'all' | 'behavioral' | 'technical' | 'situational' | 'general'>('all')

  // PDF generation
  const [pdfGenerating, setPdfGenerating] = useState(false)

  // Application Tracker integration
  const [fromJobId, setFromJobId]       = useState<string | null>(null)
  const [fromTitle, setFromTitle]       = useState<string | null>(null)
  const [fromCompany, setFromCompany]   = useState<string | null>(null)
  const [saveTrackerStatus, setSaveTrackerStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [trackerJd, setTrackerJd]       = useState<string>('')
  const [trackerJdLoading, setTrackerJdLoading] = useState(false)
  const [jdPanelOpen, setJdPanelOpen]   = useState(false)

  const printRef      = useRef<HTMLDivElement>(null)
  const pdfContentRef = useRef<HTMLDivElement>(null)
  const answerRef     = useRef<HTMLTextAreaElement>(null)
  const handlePrint   = useReactToPrint({ contentRef: printRef })

  // Voice / speech
  const [voiceActive, setVoiceActive] = useState(false)
  const [voiceTarget, setVoiceTarget] = useState<'mock' | 'practice' | 'record'>('mock')
  const recognitionRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('interview-records')
    if (saved) setRecords(JSON.parse(saved))
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('interview-bookmarks')
    if (saved) setBookmarks(JSON.parse(saved))
  }, [])

  useEffect(() => {
    fetch('/api/tracker').then((r) => (r.ok ? r.json() : null)).then((res) => {
      if (!res) return
      const apps = res.applications as { company?: string; title?: string }[]
      const companies = [...new Set(apps.map(a => a.company).filter(Boolean) as string[])]
      const titleMap: Record<string, string[]> = {}
      apps.forEach(a => {
        if (a.company && a.title) {
          if (!titleMap[a.company]) titleMap[a.company] = []
          if (!titleMap[a.company].includes(a.title)) titleMap[a.company].push(a.title)
        }
      })
      setTrackerCompanies(companies)
      setTrackerTitles(titleMap)
    }).catch(() => { /* ignore */ })
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('interview-mock-sessions')
    const parsed: InterviewSession[] = saved ? JSON.parse(saved) : []
    setSessions(parsed)
    setMockStep(parsed.length > 0 ? 'sessions' : 'setup')
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const jobId   = params.get('jobId')
    const title   = params.get('title')
    const company = params.get('company')
    const question = params.get('question')
    const starDraftRaw = params.get('star_draft')
    const fromJournal = params.get('from_journal')

    if (jobId && title && company) {
      setFromJobId(jobId); setFromTitle(title); setFromCompany(company)
      setRole(title); setCompany(company); setMockStep('setup')
    } else if (question && starDraftRaw) {
      try {
        const starDraft = JSON.parse(starDraftRaw)
        setJournalLinkedQ(question)
        setJournalLinkedStar(starDraft)
        setJournalLinkedFromId(fromJournal)
        const syntheticQ: Question = { id: 'journal-' + Date.now().toString(36), question, type: 'behavioral' }
        setQuestions([syntheticQ])
        setSelectedQ(syntheticQ)
        setMockPracticeIdx(0)
        setMockStep('practice')
      } catch { /* invalid star_draft param */ }
    }
  }, [])

  useEffect(() => {
    if (!fromJobId) { setTrackerJd(''); return }
    setTrackerJdLoading(true)
    fetch('/api/tracker').then((r) => (r.ok ? r.json() : null)).then((res) => {
      const apps = (res?.applications ?? []) as { id: string; jdFullText?: string }[]
      const app = apps.find((a) => a.id === fromJobId)
      setTrackerJd(app?.jdFullText ?? '')
    }).catch(() => setTrackerJd(''))
      .finally(() => setTrackerJdLoading(false))
  }, [fromJobId])

  // Timer countdown
  useEffect(() => {
    if (timerPhase === 'idle' || timerPhase === 'expired') return
    if (timerSec <= 0) {
      if (timerPhase === 'thinking') {
        setTimerPhase('answering')
        setTimerSec(120)
      } else {
        setTimerPhase('expired')
      }
      return
    }
    const id = setTimeout(() => setTimerSec((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [timerSec, timerPhase])

  const saveRecords = useCallback((next: RealRecord[]) => {
    setRecords(next)
    localStorage.setItem('interview-records', JSON.stringify(next))
  }, [])

  const saveSessions = useCallback((next: InterviewSession[]) => {
    setSessions(next)
    localStorage.setItem('interview-mock-sessions', JSON.stringify(next))
  }, [])

  // ── Computed (QA bank) ────────────────────────────────────────────────────
  const catQuestions   = QA_BANK.find((c) => c.category === selectedCat)?.questions ?? []
  const practiceQ      = catQuestions[practiceIdx] ?? null
  const practiceResult = practiceQ ? practiceResults[practiceQ.zh] : undefined

  function goToQuestion(idx: number) {
    const q = catQuestions[idx]
    setPracticeIdx(idx)
    setPracticeAnswer(q ? (practiceResults[q.zh]?.answer ?? '') : '')
    setShowOptimized(false)
  }

  // ── Computed (Mock) ───────────────────────────────────────────────────────
  function goToMockQuestion(idx: number) {
    const q = questions[idx]
    if (!q) return
    setMockPracticeIdx(idx)
    setSelectedQ(q)
    setAnswer(q.userAnswer ?? '')
    setShowEn(false)
    setShowMockOptimized(false)
    setFollowUpQ(q.followUpQ ?? '')
    setFollowUpAnswer(q.followUpAnswer ?? '')
    setFollowUpStep(q.aiScore !== undefined ? 'scored' : 'none')
    stopTimer()
    if (interviewMode === 'simulation' && !q.userAnswer) {
      startSimTimer()
    }
  }

  function saveMockAnswer() {
    if (!selectedQ || !answer.trim()) return
    const rec: RealRecord = {
      id: genId(), question: selectedQ.question, answer,
      score: selectedQ.aiScore, feedback: selectedQ.aiFeedback,
      date: new Date().toISOString(),
    }
    saveRecords([rec, ...records])
  }

  function loadSession(session: InterviewSession) {
    setRole(session.jobTitle)
    setCompany(session.company ?? '')
    setCurrentSessionId(session.id)
    const qs: Question[] = session.questions.map((q) => ({
      id: q.id, question: q.question, questionEn: q.questionEn,
      type: q.type, userAnswer: q.userAnswer, aiScore: q.aiScore, aiFeedback: q.aiFeedback,
    }))
    setQuestions(qs)
    setSelectedQ(null); setAnswer(''); setMockPracticeIdx(0)
    setMockStep('list')
  }

  function restartWithSetup(session: InterviewSession) {
    setRole(session.jobTitle)
    setCompany(session.company ?? '')
    setCurrentSessionId(null)
    setQuestions([]); setSelectedQ(null); setAnswer('')
    setMockStep('setup')
  }

  function deleteSession(id: string) {
    const next = sessions.filter((s) => s.id !== id)
    saveSessions(next)
    if (next.length === 0) setMockStep('setup')
  }

  // ── Voice ──────────────────────────────────────────────────────────────────
  function startVoice(target: typeof voiceTarget) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('你的瀏覽器不支援語音輸入，請使用 Chrome 或 Safari'); return }
    if (voiceActive) { recognitionRef.current?.stop(); setVoiceActive(false); return }
    const r = new SR()
    r.lang = answerLang === 'en' ? 'en-US' : 'zh-TW'
    r.continuous = true; r.interimResults = false
    r.onresult = (e) => {
      const t = Array.from(e.results).map((x) => x[0].transcript).join('')
      if (target === 'mock') setAnswer((p) => p + t)
      else if (target === 'practice') setPracticeAnswer((p) => p + t)
      else setRecAnswer((p) => p + t)
    }
    r.onerror = () => setVoiceActive(false)
    r.onend   = () => setVoiceActive(false)
    recognitionRef.current = r; r.start()
    setVoiceActive(true); setVoiceTarget(target)
  }

  // ── Mock interview ─────────────────────────────────────────────────────────
  async function generateQuestions() {
    if (!role.trim()) return
    setGenerating(true); setQuestions([]); setSelectedQ(null); setAnswer('')
    setSaveTrackerStatus('idle')
    setMockStep('list')
    try {
      let jdContent: string | undefined
      if (fromJobId) {
        try {
          const tRes = await fetch('/api/tracker')
          if (tRes.ok) {
            const { applications: apps } = await tRes.json() as { applications: { id: string; jdFullText?: string }[] }
            const app = apps.find((a) => a.id === fromJobId)
            if (app?.jdFullText) jdContent = app.jdFullText
          }
        } catch { /* ignore */ }
      }
      const res  = await fetch('/api/interview/questions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, company, questionCount, jdContent, scenario }),
      })
      const data = await res.json()

      // Assign framework on program side — never trust AI for this
      const aiQs: Question[] = (data.questions ?? []).map((q: Question) => ({
        ...q,
        framework: q.question_type ? FRAMEWORK_MAP[q.question_type] : 'STAR',
      }))

      // Client-side filtering: keep only questions suitable for current scenario
      const filtered = aiQs.filter(
        (q) => !q.suitable_for || q.suitable_for.includes(scenario) || q.suitable_for.includes('all')
      )

      // Supplement with scenario-specific fallbacks if AI returned too few
      const fallbacks = (FALLBACK_QUESTIONS[scenario] ?? []).map((q) => ({
        ...q,
        framework: q.question_type ? FRAMEWORK_MAP[q.question_type] : 'STAR',
      }))
      let combined = filtered
      if (combined.length < questionCount) {
        const existing = new Set(combined.map((q) => q.id))
        const extra = fallbacks.filter((q) => !existing.has(q.id)).slice(0, questionCount - combined.length)
        combined = [...combined, ...extra]
      }

      // Mix in universal questions (max 5) if toggle is on
      if (includeUniversal) {
        const shuffled = [...UNIVERSAL_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 5)
        const existing = new Set(combined.map((q) => q.id))
        combined = [...combined, ...shuffled.filter((q) => !existing.has(q.id))]
      }

      setQuestions(combined)
      const newSession: InterviewSession = {
        id: genId(), jobTitle: role, company: company || undefined,
        language: answerLang === 'en' ? 'en-US' : 'zh-TW',
        questions: combined.map((q) => ({ id: q.id, question: q.question, questionEn: q.questionEn, type: q.type })),
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }
      setCurrentSessionId(newSession.id)
      saveSessions([newSession, ...sessions])
    } catch { /* silent */ }
    finally { setGenerating(false) }
  }

  function clearTrackerLink() {
    setFromJobId(null); setFromTitle(null); setFromCompany(null)
    setRole(''); setCompany('')
  }

  async function saveToTracker() {
    if (!fromJobId || !report) return
    setSaveTrackerStatus('saving')
    try {
      const res = await fetch('/api/tracker')
      if (!res.ok) throw new Error('load failed')
      const { applications: apps } = await res.json() as {
        applications: { id: string; interviewNotes?: { id: string; date: string; interviewer: string; notes: string }[] }[]
      }
      const note = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        date: new Date().toISOString().slice(0, 10),
        interviewer: '模擬面試',
        notes: `來自 Interview Arena 模擬練習｜題數：${questions.length}｜平均分：${report.avgScore.toFixed(1)}/10`,
      }
      const updated = apps.map((a) =>
        a.id === fromJobId ? { ...a, interviewNotes: [...(a.interviewNotes ?? []), note] } : a
      )
      const putRes = await fetch('/api/tracker', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applications: updated }),
      })
      if (!putRes.ok) throw new Error('save failed')
      setSaveTrackerStatus('saved')
    } catch {
      setSaveTrackerStatus('idle')
    }
  }

  async function evaluate(forPractice = false) {
    const q = forPractice ? (qaBankLang === 'en' ? practiceQ?.en : practiceQ?.zh) : selectedQ?.question
    const a = forPractice ? practiceAnswer : answer
    if (!q || !a?.trim()) return
    if (forPractice) setPracticeEval(true); else setEvaluating(true)
    try {
      const res  = await fetch('/api/interview/evaluate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q, answer: a }) })
      const data = await res.json()
      if (forPractice && practiceQ) {
        setPracticeResults((prev) => ({
          ...prev,
          [practiceQ.zh]: {
            answer: a, score: data.score ?? 0,
            strengths: Array.isArray(data.strengths) ? data.strengths : [],
            suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
            optimizedAnswer: data.optimizedAnswer ?? data.feedback ?? '',
          },
        }))
      } else {
        const updates = {
          userAnswer: a, aiFeedback: data.feedback ?? '', aiScore: data.score ?? 0,
          strengths: Array.isArray(data.strengths) ? data.strengths : [],
          suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
          optimizedAnswer: data.optimizedAnswer ?? data.feedback ?? '',
        }
        setQuestions((p) => p.map((qu) => qu.id === selectedQ?.id ? { ...qu, ...updates } : qu))
        setSelectedQ((p) => p && { ...p, ...updates })
        // Persist answer to session
        if (currentSessionId && selectedQ) {
          setSessions((prev) => {
            const next = prev.map((s) => s.id !== currentSessionId ? s : {
              ...s, updatedAt: new Date().toISOString(),
              questions: s.questions.map((sq) => sq.id !== selectedQ.id ? sq : {
                ...sq, userAnswer: a, aiScore: data.score ?? 0, aiFeedback: data.feedback ?? '',
              }),
            })
            localStorage.setItem('interview-mock-sessions', JSON.stringify(next))
            return next
          })
        }
      }
    } catch { /* silent */ }
    finally { if (forPractice) setPracticeEval(false); else setEvaluating(false) }
  }

  // ── Real record ────────────────────────────────────────────────────────────
  async function evaluateRecord() {
    if (!recQuestion.trim() || !recAnswer.trim()) return
    setRecEvaluating(true)
    try {
      const res  = await fetch('/api/interview/evaluate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: recQuestion, answer: recAnswer }) })
      const data = await res.json()
      const rec: RealRecord = {
        id: genId(), question: recQuestion, answer: recAnswer,
        score: data.score, feedback: data.feedback, date: new Date().toISOString(),
        interview_date: recDate || undefined,
        company: recCompany.trim() || undefined,
        title: recTitle.trim() || undefined,
      }
      saveRecords([rec, ...records])
      setRecQuestion(''); setRecAnswer('')
      setRecDate(new Date().toISOString().slice(0, 10))
      setRecCompany(''); setRecTitle('')
    } catch { /* silent */ }
    finally { setRecEvaluating(false) }
  }

  function deleteRecord(id: string) { saveRecords(records.filter((r) => r.id !== id)) }

  const saveBookmarks = useCallback((next: BookmarkedQuestion[]) => {
    setBookmarks(next)
    localStorage.setItem('interview-bookmarks', JSON.stringify(next))
  }, [])

  function bookmarkQ(q: Question) {
    if (!q.userAnswer) return
    const bm: BookmarkedQuestion = {
      id: genId(),
      question: q.question, questionEn: q.questionEn,
      type: q.type, question_type: q.question_type, framework: q.framework,
      userAnswer: q.userAnswer,
      aiScore: q.aiScore, aiFeedback: q.aiFeedback,
      strengths: q.strengths, suggestions: q.suggestions, optimizedAnswer: q.optimizedAnswer,
      savedAt: new Date().toISOString(), fromRole: role || undefined,
    }
    saveBookmarks([bm, ...bookmarks.filter((b) => b.question !== bm.question)])
  }

  function bookmarkQuestion() {
    if (!selectedQ) return
    const q: Question = { ...selectedQ, userAnswer: selectedQ.userAnswer ?? answer }
    bookmarkQ(q)
  }

  async function downloadInterviewPDF() {
    const answered = questions.filter((q) => q.aiScore !== undefined)
    if (answered.length === 0 || !pdfContentRef.current) return
    setPdfGenerating(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')
      const el = pdfContentRef.current
      el.style.display = 'block'
      await new Promise((r) => setTimeout(r, 50))
      const canvas = await html2canvas(el, {
        scale: 2, useCORS: true, backgroundColor: '#ffffff',
        width: el.offsetWidth, height: el.scrollHeight, logging: false,
      })
      el.style.display = 'none'
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pdfW = 210; const pageH = 297
      const totalPdfH = (canvas.height / canvas.width) * pdfW
      const imgData = canvas.toDataURL('image/png')
      if (totalPdfH <= pageH) {
        pdf.addImage(imgData, 'PNG', 0, 0, pdfW, totalPdfH)
      } else {
        const pagePixelH = Math.floor((pageH / pdfW) * canvas.width)
        let yPx = 0; let firstPage = true
        while (yPx < canvas.height) {
          const sliceH = Math.min(pagePixelH, canvas.height - yPx)
          const pageCanvas = document.createElement('canvas')
          pageCanvas.width = canvas.width; pageCanvas.height = sliceH
          const ctx = pageCanvas.getContext('2d')
          if (ctx) ctx.drawImage(canvas, 0, yPx, canvas.width, sliceH, 0, 0, canvas.width, sliceH)
          if (!firstPage) pdf.addPage()
          const slicePdfH = (sliceH / canvas.width) * pdfW
          pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', 0, 0, pdfW, slicePdfH)
          yPx += sliceH; firstPage = false
        }
      }
      const companyName = company || fromCompany || '面試'
      const dateStr = new Date().toISOString().slice(0, 10)
      pdf.save(`${companyName}-${role || '練習'}-面試練習-${dateStr}.pdf`)
    } catch { /* silent */ }
    finally { setPdfGenerating(false) }
  }

  // ── Timer helpers ─────────────────────────────────────────────────────────
  function stopTimer() { setTimerPhase('idle'); setTimerSec(0) }

  function startSimTimer() { setTimerPhase('thinking'); setTimerSec(30) }

  // ── Follow-up + evaluation ─────────────────────────────────────────────────
  async function generateFollowUp() {
    if (!selectedQ || !answer.trim()) return
    const style = INTERVIEWER_STYLES.find((s) => s.id === interviewerStyle)
    setGeneratingFollowUp(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `你是一位面試官。${style?.prompt ?? ''}
根據以下面試題目和使用者的回答，生成一道深入追問，目的是讓使用者補充具體細節或數據。追問要簡短（一句話），用繁體中文，語氣像真實面試官。
題目：${selectedQ.question}
使用者回答：${answer}
只輸出追問本身，不要加任何前綴或解釋。`,
          }],
        }),
      })
      const data = await res.json()
      setFollowUpQ(data.reply?.trim() ?? '你能提供更具體的例子或數據嗎？')
      setFollowUpStep('followup')
    } catch {
      setFollowUpQ('你能提供更具體的例子或數據嗎？')
      setFollowUpStep('followup')
    } finally { setGeneratingFollowUp(false) }
  }

  async function evaluateMockWithFollowUp(fAnswer: string, incompleteTime = false) {
    if (!selectedQ) return
    setEvaluating(true)
    const combined = fAnswer.trim()
      ? `${answer}\n\n[追問] ${followUpQ}\n[回答] ${fAnswer}`
      : answer
    const note = incompleteTime ? '\n（使用者因計時到而自動提交，回答可能不完整）' : ''
    try {
      const res = await fetch('/api/interview/evaluate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: selectedQ.question, answer: combined + note }),
      })
      const data = await res.json()
      const suggText = (data.suggestions ?? []).join(' ')
      const weaknessLabels: string[] = []
      if (/具體|數據|數字|量化/.test(suggText)) weaknessLabels.push('缺乏數據')
      if (/STAR|結構|情境|任務/.test(suggText)) weaknessLabels.push('STAR 結構不完整')
      if (/籠統|模糊|不夠清楚|太簡短/.test(suggText)) weaknessLabels.push('內容太籠統')
      const updates = {
        userAnswer: answer, aiFeedback: data.feedback ?? '', aiScore: data.score ?? 0,
        strengths: Array.isArray(data.strengths) ? data.strengths : [],
        suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
        optimizedAnswer: data.optimizedAnswer ?? data.feedback ?? '',
        followUpQ, followUpAnswer: fAnswer, weaknessLabels,
        contentScore: typeof data.contentScore === 'number' ? data.contentScore : undefined,
        structureScore: typeof data.structureScore === 'number' ? data.structureScore : undefined,
        persuasionScore: typeof data.persuasionScore === 'number' ? data.persuasionScore : undefined,
        starHints: data.starHints ?? undefined,
      }
      setQuestions((p) => p.map((qu) => qu.id === selectedQ?.id ? { ...qu, ...updates } : qu))
      setSelectedQ((p) => p && { ...p, ...updates })
      setFollowUpStep('scored')
      if (answerLang === 'bilingual' && selectedQ) {
        void translateAnswer(selectedQ.id, answer, selectedQ.question, selectedQ.questionEn ?? '')
      }
      if (currentSessionId && selectedQ) {
        setSessions((prev) => {
          const next = prev.map((s) => s.id !== currentSessionId ? s : {
            ...s, updatedAt: new Date().toISOString(),
            questions: s.questions.map((sq) => sq.id !== selectedQ.id ? sq : {
              ...sq, userAnswer: answer, aiScore: data.score ?? 0, aiFeedback: data.feedback ?? '',
            }),
          })
          localStorage.setItem('interview-mock-sessions', JSON.stringify(next))
          return next
        })
      }
    } catch { /* silent */ }
    finally { setEvaluating(false) }
  }

  async function translateAnswer(questionId: string, answerZh: string, questionZh: string, questionEn: string) {
    setTranslating(true)
    try {
      const res = await fetch('/api/interviews/translate-answer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer_zh: answerZh, question_zh: questionZh, question_en: questionEn, title: role || fromTitle || '' }),
      })
      const data = await res.json()
      setBilingualData((prev) => ({
        ...prev,
        [questionId]: { translation: data.translation ?? '', tips: Array.isArray(data.tips) ? data.tips : [] },
      }))
    } catch { /* silent */ }
    finally { setTranslating(false) }
  }

  // ── Summary report ─────────────────────────────────────────────────────────
  async function generateReport() {
    const answered = questions.filter((q) => q.aiScore !== undefined)
    if (answered.length === 0) return
    setMockStep('report')
    setReport(null)
    setGeneratingReport(true)
    const avg = answered.reduce((s, q) => s + (q.aiScore ?? 0), 0) / answered.length
    const typeMap: Record<string, number[]> = {}
    answered.forEach((q) => { if (!typeMap[q.type]) typeMap[q.type] = []; typeMap[q.type].push(q.aiScore ?? 0) })
    const typeAvgs = Object.entries(typeMap)
      .map(([t, scores]) => ({ type: t, avg: scores.reduce((a, b) => a + b, 0) / scores.length }))
      .sort((a, b) => b.avg - a.avg)
    const bestType = typeAvgs[0]?.type ?? 'behavioral'
    const worstType = typeAvgs[typeAvgs.length - 1]?.type ?? 'general'
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `請分析以下面試表現，用 JSON 格式回覆（只回傳 JSON，不要其他文字）：
{"dimensions":{"content":1到10的分數,"clarity":1到10的分數,"concrete":1到10的分數,"star":1到10的分數},"overallSuggestions":["具體建議1","具體建議2","具體建議3"]}
面試紀錄：
${answered.map((q, i) => `題${i + 1}（${TYPE[q.type]?.label}）：${q.question}\n分數：${q.aiScore}\n回答摘要：${(q.userAnswer ?? '').slice(0, 200)}`).join('\n\n')}`,
          }],
        }),
      })
      const data = await res.json()
      const m = data.reply?.match(/\{[\s\S]*\}/)
      const parsed = m ? JSON.parse(m[0]) : {}
      setReport({
        avgScore: avg,
        questionScores: answered.map((q, i) => ({ idx: i, score: q.aiScore ?? 0, type: q.type })),
        bestType, worstType,
        overallSuggestions: parsed.overallSuggestions ?? ['持續練習，累積具體工作案例', '使用 STAR 結構讓回答更有層次', '多準備數字化成果以增加說服力'],
        dimensions: parsed.dimensions ?? { content: 7, clarity: 7, concrete: 6, star: 7 },
      })
    } catch {
      setReport({
        avgScore: avg,
        questionScores: answered.map((q, i) => ({ idx: i, score: q.aiScore ?? 0, type: q.type })),
        bestType, worstType,
        overallSuggestions: ['持續練習，累積具體工作案例', '使用 STAR 結構讓回答更有層次', '多準備數字化成果以增加說服力'],
        dimensions: { content: 7, clarity: 7, concrete: 6, star: 7 },
      })
    } finally { setGeneratingReport(false) }
  }

  // ── Shared UI pieces ──────────────────────────────────────────────────────
  const voiceBtn = (target: typeof voiceTarget) => (
    <button onClick={() => startVoice(target)}
      className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition-all ${voiceActive && voiceTarget === target ? 'border-red-300 bg-red-50 text-red-500' : 'border-warm-200 bg-cream-200 text-ink-500 hover:border-warm-300'}`}>
      {voiceActive && voiceTarget === target ? '⏹ 停止錄音' : '🎤 語音輸入'}
    </button>
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 pt-16 md:pt-8 md:p-8 space-y-5">
      <PageTooltip pageKey="interviews" />
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-ink-900">⬟ Interview Arena</h1>
        <p className="mt-1 text-sm text-ink-500">AI 模擬面試 · 常見題庫 · 實際面試記錄 · PDF 匯出</p>
      </div>

      <div className="flex gap-1 rounded-xl border border-warm-200 bg-white p-1 w-full sm:w-fit shadow-[var(--shadow-warm-xs)] overflow-x-auto">
        {([
          ['mock',   '⬟ 模擬面試'],
          ['record', '🎙 實際記錄'],
          ['bank',   '⭐ 個人題庫'],
        ] as const).map(([t, label]) => (
          <button key={t} onClick={() => { setTab(t); setSelectedQ(null); setAnswer('') }}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${tab === t ? 'bg-cream-200 text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-600'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MOCK INTERVIEW
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'mock' && (
        <>
          {/* ── Journal-linked banner ── */}
          {journalLinkedQ && (
            <div className="flex items-center gap-2 rounded-xl border border-sage-200 bg-sage-50 px-4 py-3 text-sm text-sage-700 mb-4">
              <span>📓</span>
              <span className="flex-1">來自 Work Journal，已帶入 STAR 草稿供參考</span>
              {journalLinkedFromId && (
                <a href="/work-journal" className="text-xs text-sage-500 hover:text-sage-700 whitespace-nowrap transition-colors">← 返回日誌</a>
              )}
            </div>
          )}

          {/* ── Loading ── */}
          {mockStep === 'loading' && (
            <div className="flex items-center justify-center py-20">
              <svg className="h-5 w-5 animate-spin text-terra-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
          )}

          {/* ── Sessions list ── */}
          {mockStep === 'sessions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-ink-800">我的模擬面試</h2>
                  <p className="text-xs text-ink-400 mt-0.5">共 {sessions.length} 個面試情境</p>
                </div>
                <button
                  onClick={() => { setRole(''); setCompany(''); setCurrentSessionId(null); setQuestions([]); setMockStep('setup') }}
                  className="flex items-center gap-1.5 rounded-xl bg-terra-500 px-4 py-2 text-sm font-semibold text-white hover:bg-terra-700 transition-colors shadow-[var(--shadow-warm-sm)]">
                  ＋ 新增面試
                </button>
              </div>

              <div className="space-y-3">
                {sessions.map((s) => {
                  const answered = s.questions.filter((q) => q.userAnswer).length
                  const total    = s.questions.length
                  const pct      = total > 0 ? Math.round((answered / total) * 100) : 0
                  return (
                    <Card key={s.id}>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex-1 min-w-0 space-y-2">
                            <div>
                              <p className="font-semibold text-ink-800">{s.jobTitle}</p>
                              {s.company && <p className="text-xs text-ink-400">{s.company}</p>}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-ink-400 flex-wrap">
                              <span>📋 {total} 道題目</span>
                              <span>📅 {new Date(s.createdAt).toLocaleDateString('zh-TW')}</span>
                              <span className={answered === total && total > 0 ? 'text-sage-600 font-medium' : ''}>
                                {answered === total && total > 0 ? '✓ ' : ''}已完成 {answered}/{total} 題
                              </span>
                            </div>
                            <div className="relative h-1.5 rounded-full bg-cream-200 overflow-hidden w-full max-w-[300px]">
                              <div
                                className={`absolute left-0 top-0 h-full rounded-full transition-all ${pct === 100 ? 'bg-sage-500' : 'bg-terra-400'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => loadSession(s)}
                              className="rounded-xl border border-terra-300 bg-terra-50 px-3 py-1.5 text-xs font-medium text-terra-600 hover:bg-terra-100 transition-colors whitespace-nowrap">
                              {answered > 0 ? '繼續練習' : '開始練習'}
                            </button>
                            <button
                              onClick={() => restartWithSetup(s)}
                              className="rounded-xl border border-warm-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-500 hover:border-warm-300 hover:text-ink-700 transition-colors whitespace-nowrap">
                              重新開始
                            </button>
                            <button
                              onClick={() => deleteSession(s.id)}
                              className="rounded-xl border border-warm-200 px-2.5 py-1.5 text-xs text-ink-400 hover:border-red-200 hover:text-red-400 transition-all whitespace-nowrap">
                              刪除
                            </button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Setup form (no tracker) ── */}
          {mockStep === 'setup' && !fromJobId && (
            <div className="flex justify-center pt-4">
              <div className="w-full max-w-[600px] space-y-5">
                {sessions.length > 0 && (
                  <button onClick={() => setMockStep('sessions')}
                    className="flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-700 transition-colors">
                    ← 返回面試列表
                  </button>
                )}
                <div className="text-center space-y-1">
                  <h2 className="text-xl font-bold text-ink-900">設定你的面試情境</h2>
                  <p className="text-sm text-ink-400">AI 將根據職位與題數生成客製化題目</p>
                </div>
                <Card>
                  <CardContent className="pt-6 space-y-4">
                      <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-ink-500">求職情境（必選）</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {SCENARIOS.map((s) => (
                          <button key={s.id} onClick={() => setScenario(s.id)}
                            className={`flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left transition-all ${scenario === s.id ? 'border-terra-400 bg-terra-50' : 'border-warm-200 bg-white hover:border-warm-300'}`}>
                            <span className={`text-xs font-semibold ${scenario === s.id ? 'text-terra-700' : 'text-ink-700'}`}>{s.label}</span>
                            <span className="text-[10px] text-ink-400 leading-tight">{s.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <Input label="目標職位（必填）" placeholder="例如：資深前端工程師、產品經理" value={role}
                      onChange={(e) => setRole(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && generateQuestions()} />
                    <Input label="公司名稱（選填）" placeholder="例如：LINE、台積電、Shopee" value={company}
                      onChange={(e) => setCompany(e.target.value)} />
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-ink-500">題目數量</label>
                      <div className="flex gap-2">
                        {([
                          [10, '10 題', '快速練習'],
                          [15, '15 題', '標準'],
                          [20, '20 題', '完整練習'],
                        ] as const).map(([n, label, sub]) => (
                          <button key={n} onClick={() => setQuestionCount(n)}
                            className={`flex-1 rounded-xl border py-2.5 text-center transition-all ${questionCount === n ? 'border-terra-400 bg-terra-50 text-terra-700' : 'border-warm-200 bg-white text-ink-500 hover:border-warm-300'}`}>
                            <p className={`text-sm font-semibold ${questionCount === n ? 'text-terra-700' : 'text-ink-700'}`}>{label}</p>
                            <p className="text-[10px] text-ink-400 mt-0.5">{sub}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-ink-500">面試語言模式</label>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          ['zh',       '中文',        '全中文作答，AI 評分建議'],
                          ['en',       'English',     'Answer & feedback in English'],
                          ['bilingual','🌐 雙語練習',  '中文作答 + AI 英譯'],
                        ] as const).map(([lang, label, desc]) => (
                          <button key={lang} onClick={() => setAnswerLang(lang)}
                            className={`relative flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left transition-all ${answerLang === lang ? 'border-terra-400 bg-terra-50' : 'border-warm-200 bg-white hover:border-warm-300'}`}>
                            {lang === 'bilingual' && (
                              <span className="absolute top-2 right-2 bg-terra-50 text-terra-600 text-[10px] px-1.5 py-0.5 rounded-full border border-terra-200">推薦</span>
                            )}
                            <span className={`text-sm font-semibold ${answerLang === lang ? 'text-terra-700' : 'text-ink-700'}`}>{label}</span>
                            <span className="text-[10px] text-ink-400 leading-tight pr-6">{desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-ink-500">面試官風格</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {INTERVIEWER_STYLES.map((s) => (
                          <button key={s.id} onClick={() => setInterviewerStyle(s.id)}
                            className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-all ${interviewerStyle === s.id ? 'border-terra-400 bg-terra-50' : 'border-warm-200 bg-white hover:border-warm-300'}`}>
                            <span className="text-xl">{s.emoji}</span>
                            <span className={`text-xs font-semibold ${interviewerStyle === s.id ? 'text-terra-700' : 'text-ink-700'}`}>{s.label}</span>
                            <span className="text-[10px] text-ink-400 leading-tight">{s.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-ink-500">練習模式</label>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          ['practice',   '🎯 練習模式', '無時間限制，可隨時修改回答'],
                          ['simulation', '⏱ 模擬模式', '思考 30 秒 + 回答 2 分鐘，貼近真實面試'],
                        ] as const).map(([mode, label, desc]) => (
                          <button key={mode} onClick={() => setInterviewMode(mode)}
                            className={`flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left transition-all ${interviewMode === mode ? 'border-terra-400 bg-terra-50' : 'border-warm-200 bg-white hover:border-warm-300'}`}>
                            <span className={`text-sm font-semibold ${interviewMode === mode ? 'text-terra-700' : 'text-ink-700'}`}>{label}</span>
                            <span className="text-[10px] text-ink-400">{desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-warm-200 bg-cream-50 px-4 py-3 hover:border-warm-300 transition-colors">
                      <div className={`h-5 w-9 shrink-0 rounded-full transition-colors relative ${includeUniversal ? 'bg-terra-400' : 'bg-warm-200'}`}>
                        <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${includeUniversal ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-ink-700">包含通用面試題</p>
                        <p className="text-[10px] text-ink-400">AI 題目外，額外混入最多 5 道通用題（自介、缺點、AI 相關…）</p>
                      </div>
                      <input type="checkbox" checked={includeUniversal} onChange={(e) => setIncludeUniversal(e.target.checked)} className="sr-only" />
                    </label>
                    <Button variant="primary" onClick={generateQuestions} loading={generating} disabled={!role.trim()} className="w-full">
                      🤖 AI 生成面試題目
                    </Button>
                    <p className="text-center text-xs text-ink-300">AI 將根據職位與公司背景生成客製化題目</p>
                    <p className="text-center text-[11px] text-ink-400">
                      🎤 題目將根據你的技能庫個人化生成 ·{' '}
                      <Link href="/dashboard/skills" className="text-terra-500 hover:text-terra-600 transition-colors">前往管理技能庫</Link>
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* ── Setup form (from Tracker — two-column) ── */}
          {mockStep === 'setup' && fromJobId && fromTitle && fromCompany && (
            <div className="space-y-3 pt-2">
              {/* Sage banner */}
              <div className="flex items-center gap-2 rounded-xl border border-sage-200 bg-sage-50 px-4 py-3 text-sm text-sage-700">
                <span>📋</span>
                <span className="flex-1">來自 Application Tracker：<strong>{fromCompany}</strong> — <strong>{fromTitle}</strong></span>
                <button onClick={clearTrackerLink}
                  className="ml-2 text-xs text-sage-500 hover:text-sage-700 whitespace-nowrap transition-colors">
                  ✕ 清除，重新設定
                </button>
              </div>

              {/* Two-column panel */}
              <div className="flex flex-col md:flex-row rounded-2xl border border-warm-200 bg-white overflow-hidden">

                {/* ── Left: Job info ── */}
                <div className="md:w-1/2 border-b md:border-b-0 md:border-r border-warm-200">
                  {/* Mobile toggle header */}
                  <button
                    className="w-full flex items-center justify-between px-6 py-4 md:cursor-default"
                    onClick={() => setJdPanelOpen((v) => !v)}
                  >
                    <div>
                      <p className="text-sm font-medium text-ink-900 text-left">職缺資訊</p>
                      <p className="text-xs text-ink-400 mt-0.5 text-left hidden md:block">請確認以下資訊正確後再開始面試</p>
                    </div>
                    <span className="text-ink-300 text-xs md:hidden">{jdPanelOpen ? '▲' : '▼'}</span>
                  </button>

                  <div className={`px-6 pb-6 space-y-3 ${jdPanelOpen ? 'block' : 'hidden'} md:block`}>
                    <p className="text-xs text-ink-400 md:hidden">請確認以下資訊正確後再開始面試</p>

                    {/* Company */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-ink-500">公司</label>
                        <span className="text-[10px] text-ink-300">來自 Application Tracker</span>
                      </div>
                      <div className="rounded-lg border border-warm-200 bg-cream-50 px-4 py-3 text-sm text-ink-700">{fromCompany}</div>
                    </div>

                    {/* Title */}
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-ink-500">職位</label>
                      <div className="rounded-lg border border-warm-200 bg-cream-50 px-4 py-3 text-sm text-ink-700">{fromTitle}</div>
                    </div>

                    {/* JD */}
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-ink-500">職務說明 JD</label>
                      {trackerJdLoading ? (
                        <div className="rounded-lg border border-warm-200 bg-cream-50 px-4 py-3 space-y-2">
                          <div className="h-3 bg-warm-200 rounded animate-pulse w-3/4" />
                          <div className="h-3 bg-warm-200 rounded animate-pulse w-full" />
                          <div className="h-3 bg-warm-200 rounded animate-pulse w-2/3" />
                        </div>
                      ) : trackerJd ? (
                        <div className="rounded-lg border border-warm-200 bg-cream-50 px-4 py-3 text-xs text-ink-600 leading-relaxed overflow-y-auto whitespace-pre-wrap" style={{ maxHeight: 320 }}>
                          {trackerJd}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-warm-200 bg-cream-50 px-4 py-3 text-sm text-ink-300">
                          此職缺尚未填寫職務說明
                        </div>
                      )}
                    </div>

                    {/* Hint */}
                    <div className="border-l-4 border-sage-400 bg-sage-50 rounded px-3 py-2 text-sm text-sage-700">
                      AI 將根據以上 JD 內容生成針對性面試題目
                    </div>
                  </div>
                </div>

                {/* ── Right: Settings ── */}
                <div className="md:w-1/2 p-6 space-y-5 flex flex-col">
                  <div>
                    <p className="text-sm font-medium text-ink-900">設定面試情境</p>
                    <p className="text-xs text-ink-400 mt-0.5">AI 將根據職位與題數生成客製化題目</p>
                  </div>

                  {/* Scenario */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-ink-500">求職情境（必選）</label>
                    <div className="grid grid-cols-2 gap-2">
                      {SCENARIOS.map((s) => (
                        <button key={s.id} onClick={() => setScenario(s.id)}
                          className={`flex flex-col items-start gap-0.5 rounded-xl border p-2.5 text-left transition-all ${scenario === s.id ? 'border-terra-400 bg-terra-50' : 'border-warm-200 bg-white hover:border-warm-300'}`}>
                          <span className={`text-xs font-semibold ${scenario === s.id ? 'text-terra-700' : 'text-ink-700'}`}>{s.label}</span>
                          <span className="text-[10px] text-ink-400 leading-tight">{s.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Question count */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-ink-500">題目數量</label>
                    <div className="flex gap-2">
                      {([
                        [10, '10 題', '快速練習'],
                        [15, '15 題', '標準'],
                        [20, '20 題', '完整練習'],
                      ] as const).map(([n, label, sub]) => (
                        <button key={n} onClick={() => setQuestionCount(n)}
                          className={`flex-1 rounded-xl border py-2.5 text-center transition-all ${questionCount === n ? 'border-terra-400 bg-terra-50' : 'border-warm-200 bg-white hover:border-warm-300'}`}>
                          <p className={`text-sm font-semibold ${questionCount === n ? 'text-terra-700' : 'text-ink-700'}`}>{label}</p>
                          <p className="text-[10px] text-ink-400 mt-0.5">{sub}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Language */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-ink-500">面試語言模式</label>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        ['zh',       '中文',        '全中文作答，AI 評分建議'],
                        ['en',       'English',     'Answer & feedback in English'],
                        ['bilingual','🌐 雙語練習',  '中文作答 + AI 英譯'],
                      ] as const).map(([lang, label, desc]) => (
                        <button key={lang} onClick={() => setAnswerLang(lang)}
                          className={`relative flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left transition-all ${answerLang === lang ? 'border-terra-400 bg-terra-50' : 'border-warm-200 bg-white hover:border-warm-300'}`}>
                          {lang === 'bilingual' && (
                            <span className="absolute top-2 right-2 bg-terra-50 text-terra-600 text-[10px] px-1.5 py-0.5 rounded-full border border-terra-200">推薦</span>
                          )}
                          <span className={`text-sm font-semibold ${answerLang === lang ? 'text-terra-700' : 'text-ink-700'}`}>{label}</span>
                          <span className="text-[10px] text-ink-400 leading-tight pr-6">{desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Interviewer style */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-ink-500">面試官風格</label>
                    <div className="grid grid-cols-2 gap-2">
                      {INTERVIEWER_STYLES.map((s) => (
                        <button key={s.id} onClick={() => setInterviewerStyle(s.id)}
                          className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-all ${interviewerStyle === s.id ? 'border-terra-400 bg-terra-50' : 'border-warm-200 bg-white hover:border-warm-300'}`}>
                          <span className="text-xl">{s.emoji}</span>
                          <span className={`text-xs font-semibold ${interviewerStyle === s.id ? 'text-terra-700' : 'text-ink-700'}`}>{s.label}</span>
                          <span className="text-[10px] text-ink-400 leading-tight">{s.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Start button — pushed to bottom */}
                  <div className="mt-auto pt-2">
                    <button
                      onClick={generateQuestions}
                      disabled={generating}
                      className="w-full rounded-xl bg-terra-500 py-3 text-sm font-semibold text-white hover:bg-terra-700 transition-colors shadow-[var(--shadow-warm-sm)] disabled:opacity-60 flex items-center justify-center gap-2">
                      {generating ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          AI 正在根據 JD 生成客製化題目...
                        </>
                      ) : '開始面試練習 →'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Question list ── */}
          {mockStep === 'list' && (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-base font-semibold text-ink-800">
                    {role} 的面試題目{questions.length > 0 ? `（${questions.length} 題）` : ''}
                  </h2>
                  {company && <p className="text-xs text-ink-400 mt-0.5">{company}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setMockStep(sessions.length > 0 ? 'sessions' : 'setup')}
                    className="text-sm text-ink-400 hover:text-ink-700 transition-colors">
                    ← {sessions.length > 0 ? '返回列表' : '重新設定'}
                  </button>
                  <Button variant="outline" size="sm" onClick={generateQuestions} loading={generating}>
                    重新生成
                  </Button>
                </div>
              </div>

              {/* Loading */}
              {generating && (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <svg className="h-6 w-6 animate-spin text-terra-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  <p className="text-sm text-ink-400">AI 正在生成面試題目…</p>
                </div>
              )}

              {/* Question cards */}
              {!generating && (
                <div className="space-y-3">
                  {questions.length > 0 && (
                    <p className="text-xs text-ink-400 print:mb-4 hidden print:block">{role}{company ? ` · ${company}` : ''} — 模擬面試題目</p>
                  )}
                  {questions.map((q, i) => (
                    <Card key={q.id} className={q.aiScore !== undefined ? 'border-sage-200' : ''}>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start gap-4">
                          {/* Number circle */}
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${q.aiScore !== undefined ? 'border-sage-300 bg-sage-50 text-sage-600' : 'border-terra-200 bg-terra-50 text-terra-600'}`}>
                            {String(i + 1).padStart(2, '0')}
                          </div>
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-medium text-ink-800 leading-relaxed">{q.question}</p>
                            {q.questionEn && (
                              <p className="text-sm text-ink-400 mt-0.5 italic leading-snug">{q.questionEn}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Badge variant={TYPE[q.type]?.color ?? 'default'}>{TYPE[q.type]?.label}</Badge>
                              {q.aiScore !== undefined && (
                                <span className={`text-xs font-semibold ${scoreCol(q.aiScore)}`}>
                                  已練習 {q.aiScore}/10
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Action button */}
                          <button
                            onClick={() => {
                              if (q.userAnswer) {
                                // 重新練習: wipe previous answer + AI feedback before opening
                                setQuestions((prev) => prev.map((qu) =>
                                  qu.id === q.id ? {
                                    ...qu, userAnswer: undefined, aiScore: undefined,
                                    aiFeedback: undefined, strengths: undefined, suggestions: undefined,
                                    optimizedAnswer: undefined, weaknessLabels: undefined,
                                    contentScore: undefined, structureScore: undefined,
                                    persuasionScore: undefined, starHints: undefined,
                                    followUpQ: undefined, followUpAnswer: undefined,
                                  } : qu
                                ))
                                setBilingualData((prev) => { const n = { ...prev }; delete n[q.id]; return n })
                                setShowMockOptimized(false)
                                setAnswer('')
                                setFollowUpQ(''); setFollowUpAnswer(''); setFollowUpStep('none')
                              }
                              setMockStep('practice')
                              goToMockQuestion(i)
                              setTimeout(() => answerRef.current?.focus(), 80)
                            }}
                            className="print:hidden shrink-0 rounded-xl border border-terra-300 bg-terra-50 px-4 py-2 text-sm font-medium text-terra-600 hover:bg-terra-100 transition-colors whitespace-nowrap">
                            {q.userAnswer ? '重新練習' : '開始練習'}
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* PDF export + finish interview */}
              {!generating && questions.length > 0 && (
                <div className="flex items-center gap-3 flex-wrap">
                  {(() => {
                    const answeredCount = questions.filter((q) => q.aiScore !== undefined).length
                    const disabled = answeredCount === 0 || pdfGenerating
                    return (
                      <div className="relative group">
                        <button
                          onClick={() => void downloadInterviewPDF()}
                          disabled={disabled}
                          className="flex items-center gap-2 rounded-xl border border-warm-200 bg-white px-4 py-2.5 text-sm text-ink-500 hover:border-warm-300 hover:text-ink-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                          {pdfGenerating
                            ? <><svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>生成中…</>
                            : `📥 匯出練習記錄 PDF${answeredCount > 0 ? `（${answeredCount} 題）` : ''}`}
                        </button>
                        {answeredCount === 0 && (
                          <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover:block z-10 w-48 rounded-lg border border-warm-200 bg-white px-3 py-2 text-xs text-ink-500 shadow-md">
                            至少完成 1 道題目後才能匯出
                          </div>
                        )}
                      </div>
                    )
                  })()}
                  {questions.filter((q) => q.aiScore !== undefined).length > 0 && (
                    <button onClick={generateReport}
                      className="flex items-center gap-2 rounded-xl bg-terra-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-terra-700 transition-colors shadow-[var(--shadow-warm-sm)]">
                      📊 查看面試表現報告（{questions.filter((q) => q.aiScore !== undefined).length}/{questions.length} 題已完成）
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Practice ── */}
          {mockStep === 'practice' && selectedQ && (
            <div className="space-y-5 max-w-[800px]">
              {/* Timer bar - simulation mode only */}
              {interviewMode === 'simulation' && timerPhase !== 'idle' && (
                <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                  timerPhase === 'thinking' ? 'bg-honey-50 border-honey-300' :
                  timerPhase === 'expired'  ? 'bg-terra-50 border-terra-300' :
                  timerSec > 60 ? 'bg-sage-50 border-sage-300' :
                  timerSec > 30 ? 'bg-honey-50 border-honey-300' :
                  'bg-terra-50 border-terra-300'
                }`}>
                  <span className="text-sm font-medium text-ink-700">
                    {timerPhase === 'thinking' ? '🧠 思考時間' : timerPhase === 'expired' ? '⏰ 時間到！' : '⏱ 回答時間'}
                  </span>
                  {timerPhase !== 'expired' && (
                    <span className={`text-2xl font-bold tabular-nums ml-auto ${
                      timerPhase === 'thinking' ? 'text-honey-500' :
                      timerSec > 60 ? 'text-sage-600' :
                      timerSec > 30 ? 'text-honey-500' :
                      'text-terra-500 animate-pulse'
                    }`}>
                      {Math.floor(timerSec / 60).toString().padStart(2, '0')}:{(timerSec % 60).toString().padStart(2, '0')}
                    </span>
                  )}
                  {timerPhase === 'expired' && (
                    <span className="text-sm text-terra-600 ml-auto font-medium">請提交你的回答</span>
                  )}
                </div>
              )}

              {/* Top nav */}
              <div className="flex items-center gap-3 flex-wrap">
                <button onClick={() => { stopTimer(); setMockStep('list') }}
                  className="flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-700 transition-colors">
                  ← 返回題目列表
                </button>
                <span className="ml-auto text-sm text-ink-400">
                  第 {mockPracticeIdx + 1} 題 / 共 {questions.length} 題
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => { stopTimer(); goToMockQuestion(Math.max(0, mockPracticeIdx - 1)) }}
                    disabled={mockPracticeIdx === 0}
                    className="rounded-lg border border-warm-200 bg-white px-3 py-1.5 text-xs text-ink-500 hover:border-warm-300 hover:text-ink-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                    上一題
                  </button>
                  <button
                    onClick={() => { stopTimer(); goToMockQuestion(Math.min(questions.length - 1, mockPracticeIdx + 1)) }}
                    disabled={mockPracticeIdx === questions.length - 1}
                    className="rounded-lg border border-warm-200 bg-white px-3 py-1.5 text-xs text-ink-500 hover:border-warm-300 hover:text-ink-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                    下一題
                  </button>
                </div>
              </div>

              {/* Question block */}
              <div className="bg-terra-50 border-l-4 border-terra-400 p-5 rounded-r-xl">
                <Badge variant={TYPE[selectedQ.type]?.color ?? 'default'} className="mb-3">
                  {TYPE[selectedQ.type]?.label} · {TYPE[selectedQ.type]?.labelEn}
                </Badge>
                <p className="text-lg font-medium text-ink-900 leading-relaxed">{selectedQ.question}</p>
                {selectedQ.questionEn && answerLang === 'bilingual' && (
                  <p className="text-base italic text-ink-400 mt-1 leading-relaxed">{selectedQ.questionEn}</p>
                )}
                {selectedQ.questionEn && answerLang !== 'bilingual' && (
                  <div className="mt-2">
                    <button onClick={() => setShowEn((p) => !p)} className="text-xs text-terra-500 hover:text-terra-700">
                      {showEn ? '▲ 收起英文題目' : '▼ 顯示英文題目'}
                    </button>
                    {showEn && <p className="text-sm text-ink-400 mt-1 italic leading-relaxed">{selectedQ.questionEn}</p>}
                  </div>
                )}
              </div>

              {/* Answer area */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-ink-600">你的回答</label>
                {selectedQ.framework && FRAMEWORK_HINTS[selectedQ.framework] && (() => {
                  const hint = FRAMEWORK_HINTS[selectedQ.framework!]
                  return (
                    <div className="rounded-xl border border-honey-200 bg-honey-50 px-4 py-3 space-y-1.5">
                      <p className="text-xs font-semibold text-honey-700">💡 建議框架：{hint.label}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                        {hint.steps.map((step) => (
                          <span key={step} className="text-[11px] text-honey-600">{step}</span>
                        ))}
                      </div>
                      <p className="text-[11px] text-honey-500 border-t border-honey-200 pt-1.5 mt-1">⭐ {hint.tip}</p>
                    </div>
                  )
                })()}
                <textarea
                  ref={answerRef}
                  rows={8}
                  placeholder={
                    answerLang === 'en' ? 'Use STAR method: Situation → Task → Action → Result' :
                    answerLang === 'bilingual' ? '請用中文回答，AI 將自動翻譯成英文供你參考...' :
                    '建議用 STAR 方法：情境 → 任務 → 行動 → 結果'
                  }
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  disabled={timerPhase === 'thinking' || followUpStep === 'followup' || followUpStep === 'scored'}
                  className="w-full min-h-[200px] rounded-xl border border-warm-300 bg-white px-4 py-3 text-sm text-ink-800 placeholder:text-ink-400 focus:border-terra-400 focus:outline-none resize-y leading-relaxed disabled:opacity-60 disabled:cursor-not-allowed" />
                {answerLang === 'bilingual' && (
                  <p className="text-xs text-ink-300">💡 用你最自然的中文回答即可，不需要顧慮英文表達</p>
                )}
                {journalLinkedStar && (
                  <div className="rounded-xl border border-sage-200 overflow-hidden">
                    <button
                      onClick={() => setStarDraftPanelOpen((p) => !p)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-sage-50 hover:bg-sage-100 transition-colors text-left">
                      <span className="text-xs font-semibold text-sage-700">📓 參考草稿（來自 Work Journal）</span>
                      <span className="text-xs text-sage-500">{starDraftPanelOpen ? '▲ 收起' : '▼ 展開'}</span>
                    </button>
                    {starDraftPanelOpen && (
                      <div className="px-4 pb-3 pt-1 space-y-2 bg-white">
                        <p className="text-[11px] text-ink-400 pt-1">以下草稿僅供參考，請用自己的話回答</p>
                        {([
                          ['S', '背景', journalLinkedStar.situation, 'text-sage-700'],
                          ['T', '任務', journalLinkedStar.task, 'text-honey-700'],
                          ['A', '行動', journalLinkedStar.action, 'text-terra-700'],
                          ['R', '結果', journalLinkedStar.result, 'text-ink-600'],
                        ] as [string, string, string, string][]).map(([label, title, text]) => (
                          <div key={label} className="flex gap-2 text-xs leading-relaxed">
                            <span className="shrink-0 font-bold text-ink-400 w-4">{label}</span>
                            <span className="text-ink-600">{text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {followUpStep === 'none' && (
                  <div className="flex items-center gap-3">
                    {voiceBtn('mock')}
                    <button
                      onClick={() => { stopTimer(); void generateFollowUp() }}
                      disabled={!answer.trim() || generatingFollowUp || timerPhase === 'thinking'}
                      className="flex items-center gap-2 rounded-xl bg-terra-500 px-5 py-2 text-sm font-semibold text-white hover:bg-terra-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[var(--shadow-warm-sm)]">
                      {generatingFollowUp
                        ? <><svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>生成追問中…</>
                        : timerPhase === 'expired' ? '⏰ 提交回答（時間已到）' : '提交回答 →'}
                    </button>
                  </div>
                )}
              </div>

              {/* Follow-up question block */}
              {followUpStep === 'followup' && followUpQ && (
                <div className="space-y-3">
                  <div className="bg-sage-50 border-l-4 border-sage-400 p-3 rounded-r-lg">
                    <p className="text-xs font-semibold text-sage-700 mb-1">🤖 追問：</p>
                    <p className="text-sm text-ink-800 leading-relaxed">{followUpQ}</p>
                  </div>
                  <textarea
                    rows={4}
                    placeholder="回答追問..."
                    value={followUpAnswer}
                    onChange={(e) => setFollowUpAnswer(e.target.value)}
                    className="w-full rounded-xl border border-warm-300 bg-white px-4 py-3 text-sm text-ink-800 placeholder:text-ink-400 focus:border-terra-400 focus:outline-none resize-y leading-relaxed" />
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => evaluateMockWithFollowUp(followUpAnswer)}
                      disabled={!followUpAnswer.trim() || evaluating}
                      className="flex items-center gap-2 rounded-xl bg-terra-500 px-5 py-2 text-sm font-semibold text-white hover:bg-terra-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[var(--shadow-warm-sm)]">
                      {evaluating
                        ? <><svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>評分中…</>
                        : '✨ AI 評分與建議'}
                    </button>
                    {interviewMode === 'practice' && (
                      <button
                        onClick={() => evaluateMockWithFollowUp('')}
                        disabled={evaluating}
                        className="text-sm text-ink-400 hover:text-ink-600 transition-colors">
                        跳過，直接評分
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* AI feedback */}
              {selectedQ.aiScore !== undefined && (
                <div className="space-y-3">
                  {/* Block A — AI Score */}
                  <div className="bg-white border border-warm-200 rounded-xl p-4 space-y-4 shadow-[var(--shadow-warm-xs)]">
                    {answerLang === 'bilingual' && selectedQ.contentScore !== undefined ? (
                      <>
                        <div className="flex items-center gap-4">
                          <span className={`text-5xl font-bold tabular-nums ${scoreCol(selectedQ.aiScore)}`}>{selectedQ.aiScore}</span>
                          <div>
                            <p className="text-xs text-ink-400 mb-0.5">/ 10 整體</p>
                            <p className="text-honey-500 text-lg tracking-wider">{scoreStars(selectedQ.aiScore)}</p>
                          </div>
                          <span className={`ml-auto text-sm font-semibold ${scoreCol(selectedQ.aiScore)}`}>{scoreLabel(selectedQ.aiScore)}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {([
                            ['內容豐富度', selectedQ.contentScore],
                            ['STAR 結構', selectedQ.structureScore ?? selectedQ.aiScore],
                            ['說服力', selectedQ.persuasionScore ?? selectedQ.aiScore],
                          ] as [string, number][]).map(([label, sc]) => (
                            <div key={label} className="rounded-lg border border-warm-200 bg-cream-50 p-2.5 text-center">
                              <p className="text-[10px] text-ink-400 mb-1">{label}</p>
                              <p className={`text-xl font-bold tabular-nums ${scoreCol(sc)}`}>{sc}</p>
                              <p className="text-[10px] text-ink-300">/ 10</p>
                            </div>
                          ))}
                        </div>
                        {selectedQ.starHints && (
                          <div className="rounded-lg bg-honey-50 border border-honey-200 px-3 py-2 text-xs text-honey-700">
                            ⭐ STAR 提示：{selectedQ.starHints}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-4">
                        <span className={`text-5xl font-bold tabular-nums ${scoreCol(selectedQ.aiScore)}`}>{selectedQ.aiScore}</span>
                        <div>
                          <p className="text-xs text-ink-400 mb-0.5">/ 10 分</p>
                          <p className="text-honey-500 text-lg tracking-wider">{scoreStars(selectedQ.aiScore)}</p>
                        </div>
                        <span className={`ml-auto text-sm font-semibold ${scoreCol(selectedQ.aiScore)}`}>{scoreLabel(selectedQ.aiScore)}</span>
                      </div>
                    )}

                    {selectedQ.strengths && selectedQ.strengths.length > 0 && (
                      <div className="rounded-xl bg-sage-50 border border-sage-200 p-3">
                        <p className="text-xs font-semibold text-sage-600 mb-2">✓ 優點</p>
                        <ul className="space-y-1.5">
                          {selectedQ.strengths.map((s, i) => (
                            <li key={i} className="text-xs text-ink-600 flex gap-1.5 leading-relaxed">
                              <span className="text-sage-500 shrink-0 mt-0.5">✓</span>{s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedQ.suggestions && selectedQ.suggestions.length > 0 && (
                      <div className="rounded-xl bg-terra-50 border border-terra-200 p-3">
                        <p className="text-xs font-semibold text-terra-500 mb-2">→ 改善建議</p>
                        <ul className="space-y-1.5">
                          {selectedQ.suggestions.map((s, i) => (
                            <li key={i} className="text-xs text-ink-600 flex gap-1.5 leading-relaxed">
                              <span className="text-terra-500 shrink-0 mt-0.5">→</span>{s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedQ.optimizedAnswer && (
                      <>
                        <button
                          onClick={() => setShowMockOptimized((p) => !p)}
                          className="flex items-center justify-center gap-2 w-full rounded-xl border border-terra-200 bg-terra-50 px-4 py-2.5 text-sm font-medium text-terra-600 hover:bg-terra-100 transition-colors">
                          {showMockOptimized ? '▲ 收起 AI 優化版回答' : '查看 AI 優化版回答'}
                        </button>
                        {showMockOptimized && (
                          <div className="rounded-xl border border-terra-200 bg-terra-50 p-4">
                            <p className="text-xs font-semibold text-terra-500 mb-2">AI 建議回答</p>
                            <p className="text-sm text-ink-600 whitespace-pre-line leading-relaxed">{selectedQ.optimizedAnswer}</p>
                          </div>
                        )}
                      </>
                    )}

                    <button
                      onClick={bookmarkQuestion}
                      disabled={!selectedQ?.userAnswer && !answer.trim()}
                      className="flex items-center gap-2 rounded-xl border border-honey-200 bg-honey-50 px-4 py-2 text-sm text-honey-700 hover:bg-honey-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                      ⭐ 收藏此題到個人題庫
                    </button>
                  </div>

                  {/* Block B — 英文翻譯 (bilingual only) */}
                  {answerLang === 'bilingual' && (
                    <div className="bg-cream-50 border border-warm-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-ink-800">🌐 英文翻譯</p>
                        {translating && <span className="text-xs text-ink-400 animate-pulse">翻譯中…</span>}
                      </div>
                      {translating && !bilingualData[selectedQ.id] ? (
                        <div className="space-y-2">
                          <div className="h-3 bg-warm-200 rounded animate-pulse w-full" />
                          <div className="h-3 bg-warm-200 rounded animate-pulse w-4/5" />
                          <div className="h-3 bg-warm-200 rounded animate-pulse w-3/4" />
                        </div>
                      ) : bilingualData[selectedQ.id] ? (
                        <>
                          {bilingualData[selectedQ.id].isEditing ? (
                            <textarea
                              rows={6}
                              value={bilingualData[selectedQ.id].editedTranslation ?? bilingualData[selectedQ.id].translation}
                              onChange={(e) => setBilingualData((p) => ({ ...p, [selectedQ.id]: { ...p[selectedQ.id], editedTranslation: e.target.value } }))}
                              className="w-full rounded-xl border border-warm-300 bg-white px-4 py-3 text-sm text-ink-800 focus:border-terra-400 focus:outline-none resize-y leading-relaxed"
                            />
                          ) : (
                            <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-wrap">
                              {bilingualData[selectedQ.id].editedTranslation ?? bilingualData[selectedQ.id].translation}
                            </p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => {
                                const text = bilingualData[selectedQ.id].editedTranslation ?? bilingualData[selectedQ.id].translation
                                void navigator.clipboard.writeText(text)
                              }}
                              className="min-h-[44px] flex items-center gap-1.5 rounded-lg border border-warm-200 bg-white px-3 py-2 text-xs text-ink-500 hover:border-warm-300 hover:text-ink-700 transition-colors">
                              📋 複製
                            </button>
                            <button
                              onClick={() => setBilingualData((p) => ({ ...p, [selectedQ.id]: { ...p[selectedQ.id], isEditing: !p[selectedQ.id].isEditing } }))}
                              className="min-h-[44px] flex items-center gap-1.5 rounded-lg border border-warm-200 bg-white px-3 py-2 text-xs text-ink-500 hover:border-warm-300 hover:text-ink-700 transition-colors">
                              ✏️ {bilingualData[selectedQ.id].isEditing ? '完成編輯' : '編輯'}
                            </button>
                            <button
                              onClick={() => void translateAnswer(selectedQ.id, selectedQ.userAnswer ?? answer, selectedQ.question, selectedQ.questionEn ?? '')}
                              disabled={translating}
                              className="min-h-[44px] flex items-center gap-1.5 rounded-lg border border-warm-200 bg-white px-3 py-2 text-xs text-ink-400 hover:border-warm-300 hover:text-ink-600 transition-colors disabled:opacity-50">
                              🔄 重新翻譯
                            </button>
                          </div>
                          <p className="text-[11px] text-ink-300">翻譯由 AI 生成，建議在正式面試前自行確認表達是否符合你的習慣</p>
                        </>
                      ) : (
                        <p className="text-sm text-ink-300">提交回答後將自動生成英文翻譯</p>
                      )}
                    </div>
                  )}

                  {/* Block C — 學習提示 (bilingual only) */}
                  {answerLang === 'bilingual' && bilingualData[selectedQ.id]?.tips && bilingualData[selectedQ.id].tips.length > 0 && (
                    <div className="bg-sage-50 border-l-4 border-l-sage-400 rounded-xl p-4 space-y-3">
                      <p className="text-sm font-semibold text-sage-700">📚 職場英文學習提示</p>
                      <ul className="space-y-3">
                        {bilingualData[selectedQ.id].tips.map((tip, i) => (
                          <li key={i} className="space-y-0.5">
                            <p className="text-xs font-medium text-ink-700">
                              <span className="text-sage-600">{tip.phrase}</span>
                              {' → '}
                              <span className="font-semibold text-ink-900">{tip.usage}</span>
                            </p>
                            <p className="text-[11px] text-ink-500 italic leading-relaxed">{tip.example}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {/* ── Report ── */}
          {mockStep === 'report' && (
            <div className="space-y-6 max-w-[900px]">
              <div className="flex items-center gap-3">
                <button onClick={() => setMockStep('list')}
                  className="flex items-center gap-1.5 rounded-lg border border-warm-200 bg-white px-3 py-1.5 text-sm text-ink-500 hover:border-warm-300 hover:text-ink-700 transition-colors">
                  ← 返回題目列表
                </button>
                <h2 className="text-lg font-bold text-ink-900">面試表現報告</h2>
              </div>

              {generatingReport ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3">
                  <svg className="h-8 w-8 animate-spin text-terra-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  <p className="text-sm text-ink-400">AI 正在分析你的面試表現…</p>
                </div>
              ) : report ? (
                <>
                  {/* Overall score */}
                  <Card>
                    <CardContent className="pt-6 pb-6">
                      <div className="flex items-center gap-6 flex-wrap">
                        <div className="text-center">
                          <div className={`text-6xl font-bold tabular-nums ${scoreCol(report.avgScore)}`}>
                            {report.avgScore.toFixed(1)}
                          </div>
                          <p className="text-xs text-ink-400 mt-1">/ 10 整體平均</p>
                        </div>
                        <div className={`text-2xl font-bold border-l border-warm-200 pl-6 ${scoreCol(report.avgScore)}`}>
                          {report.avgScore >= 8 ? '優秀 🎉' : report.avgScore >= 6 ? '良好 👍' : '待改善 💪'}
                        </div>
                        <div className="ml-auto text-right text-xs text-ink-400 space-y-1">
                          <p>已完成 <span className="font-semibold text-ink-700">{report.questionScores.length}</span> 題</p>
                          <p>最強題型：<span className="font-semibold text-sage-600">{TYPE[report.bestType]?.label}</span></p>
                          <p>重點加強：<span className="font-semibold text-terra-500">{TYPE[report.worstType]?.label}</span></p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Score bar chart */}
                  <Card>
                    <CardHeader><CardTitle>各題得分</CardTitle></CardHeader>
                    <CardContent>
                      <div className="flex items-end gap-2 h-40 pb-6 relative">
                        {[2, 4, 6, 8, 10].map((v) => (
                          <div key={v} className="absolute left-0 right-0 flex items-center gap-1" style={{ bottom: `${(v / 10) * 120}px` }}>
                            <span className="text-[9px] text-ink-300 w-3">{v}</span>
                            <div className="flex-1 border-t border-dashed border-warm-100" />
                          </div>
                        ))}
                        <div className="flex items-end gap-2 w-full pl-4">
                          {report.questionScores.map((qs, i) => (
                            <div key={i} className="flex flex-col items-center gap-1 flex-1">
                              <span className={`text-[10px] font-semibold ${scoreCol(qs.score)}`}>{qs.score}</span>
                              <div className="w-full rounded-t-md min-h-[4px] transition-all"
                                style={{
                                  height: `${(qs.score / 10) * 120}px`,
                                  backgroundColor: qs.score >= 8 ? '#5a7a60' : qs.score >= 5 ? '#c49a35' : '#b85048',
                                }} />
                              <span className="text-[9px] text-ink-400">Q{qs.idx + 1}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 4-dimension analysis */}
                  <Card>
                    <CardHeader><CardTitle>能力維度分析</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {([
                          ['content', '內容完整度'],
                          ['clarity', '表達清晰度'],
                          ['concrete', '具體程度'],
                          ['star', 'STAR 結構'],
                        ] as const).map(([key, label]) => {
                          const score = report.dimensions[key]
                          return (
                            <div key={key}>
                              <div className="flex justify-between text-sm mb-2">
                                <span className="text-ink-700 font-medium">{label}</span>
                                <span className={`font-bold ${scoreCol(score)}`}>{score}/10</span>
                              </div>
                              <div className="h-2.5 rounded-full bg-cream-200 overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-700"
                                  style={{
                                    width: `${score * 10}%`,
                                    backgroundColor: score >= 8 ? '#5a7a60' : score >= 5 ? '#c49a35' : '#b85048',
                                  }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* AI overall suggestions */}
                  <Card>
                    <CardHeader><CardTitle>整體改善建議</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {report.overallSuggestions.map((s, i) => (
                        <div key={i} className="flex gap-3 p-3 rounded-xl bg-sage-50 border border-sage-200">
                          <span className="text-sage-600 font-bold text-sm shrink-0 mt-0.5">{i + 1}</span>
                          <p className="text-sm text-ink-700 leading-relaxed">{s}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Review cards */}
                  <div>
                    <h3 className="text-base font-semibold text-ink-800 mb-3">複盤區塊</h3>
                    <div className="space-y-3">
                      {questions.filter((q) => q.aiScore !== undefined).map((q, i) => (
                        <div key={q.id} className="bg-white border border-warm-200 shadow-[var(--shadow-warm-xs)] rounded-2xl p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <Badge variant={TYPE[q.type]?.color ?? 'default'}>{TYPE[q.type]?.label}</Badge>
                                <span className={`text-sm font-bold ${scoreCol(q.aiScore ?? 0)}`}>{q.aiScore}/10</span>
                                {(q.weaknessLabels ?? []).map((wl) => (
                                  <span key={wl} className="bg-terra-50 text-terra-600 text-xs px-2 py-0.5 rounded-full">{wl}</span>
                                ))}
                              </div>
                              <p className="text-sm font-medium text-ink-800 leading-relaxed">
                                {i + 1}. {q.question}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => bookmarkQ(q)}
                                disabled={!q.userAnswer}
                                className="rounded-full border border-honey-200 bg-honey-50 px-2.5 py-1 text-xs font-medium text-honey-700 hover:bg-honey-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap">
                                ⭐ 收藏
                              </button>
                              <button
                                onClick={() => {
                                  const next = { ...improvedMap, [q.id]: !improvedMap[q.id] }
                                  setImprovedMap(next)
                                  setQuestions((prev) => prev.map((qu) => qu.id === q.id ? { ...qu, improved: !improvedMap[q.id] } : qu))
                                }}
                                className={`rounded-full border px-3 py-1 text-xs font-medium transition-all whitespace-nowrap ${improvedMap[q.id] ? 'bg-sage-50 border-sage-400 text-sage-600' : 'border-warm-200 text-ink-400 hover:border-warm-300'}`}>
                                {improvedMap[q.id] ? '✓ 已改善' : '標記改善'}
                              </button>
                            </div>
                          </div>
                          <div className="mt-3 space-y-2 border-t border-warm-100 pt-2">
                            <button
                              onClick={() => setExpandedReview((p) => ({ ...p, [q.id + 'a']: !p[q.id + 'a'] }))}
                              className="text-xs text-ink-400 hover:text-ink-600 transition-colors">
                              {expandedReview[q.id + 'a'] ? '▲ 收起你的回答' : '▼ 查看你的回答'}
                            </button>
                            {expandedReview[q.id + 'a'] && (
                              <div className="bg-cream-50 border border-warm-200 rounded-xl p-3">
                                <p className="text-xs text-ink-600 whitespace-pre-line leading-relaxed">{q.userAnswer}</p>
                              </div>
                            )}
                            {q.optimizedAnswer && (
                              <>
                                <button
                                  onClick={() => setExpandedReview((p) => ({ ...p, [q.id + 'o']: !p[q.id + 'o'] }))}
                                  className="text-xs text-terra-500 hover:text-terra-700 transition-colors">
                                  {expandedReview[q.id + 'o'] ? '▲ 收起 AI 建議回答' : '✨ 查看 AI 建議優化回答'}
                                </button>
                                {expandedReview[q.id + 'o'] && (
                                  <div className="bg-sage-50 border border-sage-200 rounded-xl p-3">
                                    <p className="text-xs font-semibold text-sage-600 mb-1">AI 建議回答</p>
                                    <p className="text-xs text-ink-600 whitespace-pre-line leading-relaxed">{q.optimizedAnswer}</p>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bottom actions */}
                  <div className="flex items-center gap-3 flex-wrap border-t border-warm-200 pt-4">
                    <button
                      onClick={() => void downloadInterviewPDF()}
                      disabled={pdfGenerating}
                      className="flex items-center gap-2 rounded-xl border border-warm-200 bg-white px-4 py-2.5 text-sm text-ink-500 hover:border-warm-300 hover:text-ink-700 transition-colors disabled:opacity-50">
                      {pdfGenerating ? '生成中…' : '📥 匯出練習記錄 PDF'}
                    </button>
                    {answerLang === 'bilingual' && Object.keys(bilingualData).length > 0 && (
                      <button
                        onClick={() => {
                          const companyName = company || fromCompany || '面試'
                          const date = new Date().toISOString().slice(0, 10)
                          const lines = questions
                            .filter((q) => q.userAnswer)
                            .map((q, i) => {
                              const bl = bilingualData[q.id]
                              const translation = bl?.editedTranslation ?? bl?.translation ?? '（尚未翻譯）'
                              return [
                                `Q${i + 1}. ${q.question}`,
                                q.questionEn ? `    ${q.questionEn}` : '',
                                '',
                                '我的回答（中文）：',
                                q.userAnswer ?? '',
                                '',
                                '英文版本：',
                                translation,
                                '',
                                '---',
                              ].filter((l) => l !== null).join('\n')
                            })
                          const content = lines.join('\n\n')
                          const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url; a.download = `${companyName}-面試練習-${date}.txt`
                          a.click(); URL.revokeObjectURL(url)
                        }}
                        className="flex items-center gap-2 rounded-xl border border-sage-200 bg-sage-50 px-4 py-2.5 text-sm font-medium text-sage-700 hover:bg-sage-100 transition-colors">
                        📄 匯出雙語面試稿
                      </button>
                    )}
                    <button
                      onClick={() => { setRole(fromJobId ? (fromTitle ?? '') : ''); setCompany(fromJobId ? (fromCompany ?? '') : ''); setCurrentSessionId(null); setQuestions([]); setReport(null); setSaveTrackerStatus('idle'); setMockStep('setup') }}
                      className="flex items-center gap-2 rounded-xl border border-terra-200 bg-terra-50 px-4 py-2.5 text-sm font-medium text-terra-600 hover:bg-terra-100 transition-colors">
                      🔄 重新練習
                    </button>
                    <button
                      onClick={() => setTab('bank')}
                      className="flex items-center gap-2 rounded-xl border border-honey-200 bg-honey-50 px-4 py-2.5 text-sm font-medium text-honey-700 hover:bg-honey-100 transition-colors">
                      ⭐ 查看個人題庫
                    </button>
                    {fromJobId && (
                      saveTrackerStatus === 'saved' ? (
                        <Link
                          href="/jobs"
                          className="flex items-center gap-2 rounded-xl border border-sage-200 bg-sage-50 px-4 py-2.5 text-sm font-medium text-sage-700 hover:bg-sage-100 transition-colors">
                          ✓ 已記錄至 {fromCompany} 的面試準備紀錄 →
                        </Link>
                      ) : (
                        <button
                          onClick={saveToTracker}
                          disabled={saveTrackerStatus === 'saving'}
                          className="flex items-center gap-2 rounded-xl border border-sage-200 bg-white px-4 py-2.5 text-sm text-sage-700 hover:bg-sage-50 hover:border-sage-300 transition-colors disabled:opacity-50">
                          📌 儲存此次面試記錄到 Application Tracker
                        </button>
                      )
                    )}
                  </div>
                </>
              ) : null}
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          REAL RECORD
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'record' && (
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>記錄實際面試題目</CardTitle>
                {records.length > 0 && <Button size="sm" variant="outline" onClick={() => handlePrint()}>匯出 PDF</Button>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-ink-500">面試日期（必填）</label>
                  <input
                    type="date"
                    value={recDate}
                    onChange={(e) => setRecDate(e.target.value)}
                    className="w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-ink-800 focus:border-terra-400 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-ink-500">公司名稱（必填）</label>
                  <input
                    list="rec-company-list"
                    value={recCompany}
                    onChange={(e) => setRecCompany(e.target.value)}
                    placeholder="例如：Google、台積電"
                    className="w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-ink-800 placeholder:text-ink-400 focus:border-terra-400 focus:outline-none" />
                  <datalist id="rec-company-list">
                    {trackerCompanies.map((c) => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-ink-500">應徵職位（必填）</label>
                  <input
                    list="rec-title-list"
                    value={recTitle}
                    onChange={(e) => setRecTitle(e.target.value)}
                    placeholder="例如：前端工程師"
                    className="w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-ink-800 placeholder:text-ink-400 focus:border-terra-400 focus:outline-none" />
                  <datalist id="rec-title-list">
                    {(trackerTitles[recCompany] ?? []).map((t) => <option key={t} value={t} />)}
                  </datalist>
                </div>
              </div>
              <Input label="面試題目" placeholder="輸入實際被問到的問題..." value={recQuestion} onChange={(e) => setRecQuestion(e.target.value)} />
              <div className="space-y-2">
                <Textarea label="你的回答" placeholder="記錄你當時的回答..." rows={5} value={recAnswer} onChange={(e) => setRecAnswer(e.target.value)} />
                {voiceBtn('record')}
              </div>
              <Button variant="primary" onClick={evaluateRecord} loading={recEvaluating}
                disabled={!recQuestion.trim() || !recAnswer.trim() || !recDate || !recCompany.trim() || !recTitle.trim()}>
                🤖 AI 評分 + 儲存記錄
              </Button>
            </CardContent>
          </Card>

          {records.length > 0 && (
            <div ref={printRef} className="space-y-3 print:p-6">
              <h2 className="text-sm font-semibold text-ink-600 print:text-base print:mb-4">面試紀錄 ({records.length} 題)</h2>
              {records.map((r) => (
                <Card key={r.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {r.company && <span className="text-xs font-semibold text-terra-600 bg-terra-50 border border-terra-200 rounded-full px-2 py-0.5">{r.company}</span>}
                          {r.title && <span className="text-xs text-ink-500">{r.title}</span>}
                          <span className="text-xs text-ink-400">{r.interview_date ?? new Date(r.date).toLocaleDateString('zh-TW')}</span>
                        </div>
                        <p className="text-sm font-semibold text-ink-700">{r.question}</p>
                        {r.score !== undefined && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`text-lg font-bold ${scoreCol(r.score)}`}>{r.score}</span>
                            <span className="text-xs text-ink-400">/ 10</span>
                          </div>
                        )}
                        <p className="mt-2 text-sm text-ink-600 leading-relaxed">{r.answer}</p>
                        {r.feedback && (
                          <div className="mt-3 rounded-xl border border-terra-100 bg-terra-50 p-3">
                            <p className="text-xs font-semibold text-terra-500 mb-1">AI 回饋與優化建議</p>
                            <p className="text-xs text-ink-600 whitespace-pre-line leading-relaxed">{r.feedback}</p>
                          </div>
                        )}
                      </div>
                      <button onClick={() => deleteRecord(r.id)} className="print:hidden rounded-lg border border-warm-200 px-2.5 py-1 text-xs text-ink-400 hover:border-red-200 hover:text-red-400 transition-all shrink-0">刪除</button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {records.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <p className="text-4xl mb-3">🎙</p>
              <p className="text-sm text-ink-500">記錄你在真實面試中被問到的問題</p>
              <p className="text-xs text-ink-400 mt-1">填寫面試日期、公司、職位後，AI 評分並儲存至此</p>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PERSONAL QUESTION BANK
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'bank' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-base font-semibold text-ink-800">⭐ 個人題庫</h2>
              <p className="text-xs text-ink-400 mt-0.5">從模擬面試收藏的好題目，共 {bookmarks.length} 題</p>
            </div>
            {bookmarks.length > 0 && (
              <div className="flex gap-1 rounded-xl border border-warm-200 bg-white p-1 shadow-[var(--shadow-warm-xs)]">
                {(['all', 'behavioral', 'technical', 'situational', 'general'] as const).map((t) => (
                  <button key={t} onClick={() => setBankTypeFilter(t)}
                    className={`rounded-lg px-3 py-1 text-xs font-medium transition-all whitespace-nowrap ${bankTypeFilter === t ? 'bg-cream-200 text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}>
                    {t === 'all' ? '全部' : TYPE[t]?.label ?? t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {bookmarks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <p className="text-4xl mb-3">⭐</p>
              <p className="text-sm text-ink-500">尚無收藏題目</p>
              <p className="text-xs text-ink-400 mt-1">在模擬面試中練習並評分後，點擊「⭐ 收藏此題」即可加入</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bookmarks
                .filter((b) => bankTypeFilter === 'all' || b.type === bankTypeFilter)
                .map((b) => (
                  <Card key={b.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={TYPE[b.type]?.color ?? 'default'}>{TYPE[b.type]?.label}</Badge>
                            {b.aiScore !== undefined && (
                              <span className={`text-xs font-semibold ${scoreCol(b.aiScore)}`}>{b.aiScore}/10</span>
                            )}
                            {b.fromRole && <span className="text-xs text-ink-400">來自：{b.fromRole}</span>}
                            <span className="text-xs text-ink-300">{new Date(b.savedAt).toLocaleDateString('zh-TW')}</span>
                          </div>
                          <p className="text-sm font-semibold text-ink-800 leading-relaxed">{b.question}</p>
                          {b.questionEn && <p className="text-xs text-ink-400 italic">{b.questionEn}</p>}
                          {b.framework && (
                            <span className="inline-block text-[10px] bg-honey-50 border border-honey-200 text-honey-700 rounded-full px-2 py-0.5">
                              {FRAMEWORK_HINTS[b.framework]?.label ?? b.framework}
                            </span>
                          )}
                          <div className="rounded-xl bg-cream-50 border border-warm-200 p-3">
                            <p className="text-xs font-semibold text-ink-500 mb-1">我的最佳回答</p>
                            <p className="text-sm text-ink-700 whitespace-pre-line leading-relaxed">{b.userAnswer}</p>
                          </div>
                          {b.strengths && b.strengths.length > 0 && (
                            <div className="rounded-xl bg-sage-50 border border-sage-200 p-3">
                              <p className="text-xs font-semibold text-sage-600 mb-1">✓ AI 評分優點</p>
                              <ul className="space-y-1">
                                {b.strengths.map((s, i) => (
                                  <li key={i} className="text-xs text-ink-600 flex gap-1.5">
                                    <span className="text-sage-500 shrink-0">✓</span>{s}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {b.optimizedAnswer && (
                            <div className="rounded-xl bg-terra-50 border border-terra-200 p-3">
                              <p className="text-xs font-semibold text-terra-500 mb-1">✨ AI 優化版本</p>
                              <p className="text-xs text-ink-600 whitespace-pre-line leading-relaxed">{b.optimizedAnswer}</p>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => saveBookmarks(bookmarks.filter((bk) => bk.id !== b.id))}
                          className="shrink-0 rounded-lg border border-warm-200 px-2.5 py-1 text-xs text-ink-400 hover:border-red-200 hover:text-red-400 transition-all whitespace-nowrap">
                          移除
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ── Hidden PDF content div (off-screen, rendered for html2canvas) ── */}
      <div
        ref={pdfContentRef}
        style={{ display: 'none', position: 'absolute', left: '-9999px', top: 0, width: '794px', fontFamily: 'sans-serif', color: '#333' }}>
        {/* Cover page */}
        <div style={{ padding: '48px 56px 32px', borderBottom: '2px solid #e5e0d8', marginBottom: '32px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a1a1a', marginBottom: '8px' }}>面試練習記錄</div>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>公司：{company || fromCompany || '—'}</div>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>職位：{role || '—'}</div>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>求職情境：{SCENARIOS.find((s) => s.id === scenario)?.label ?? scenario}</div>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>已完成題數：{questions.filter((q) => q.aiScore !== undefined).length} / {questions.length} 題</div>
          <div style={{ fontSize: '12px', color: '#999', marginTop: '16px' }}>匯出時間：{new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
        {/* Per-question blocks */}
        {questions.filter((q) => q.aiScore !== undefined).map((q, i) => (
          <div key={q.id} style={{ padding: '24px 56px', borderBottom: '1px solid #f0ece6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#888' }}>Q{i + 1}</span>
              <span style={{ fontSize: '11px', background: '#f5f1eb', border: '1px solid #e5ddd0', borderRadius: '99px', padding: '2px 8px', color: '#666' }}>
                {TYPE[q.type]?.label ?? q.type}
              </span>
              {q.aiScore !== undefined && (
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: q.aiScore >= 8 ? '#5a7a60' : q.aiScore >= 5 ? '#c49a35' : '#b85048' }}>
                  {q.aiScore}/10
                </span>
              )}
            </div>
            <p style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a', marginBottom: '4px', lineHeight: '1.6' }}>{q.question}</p>
            {q.questionEn && <p style={{ fontSize: '12px', color: '#888', fontStyle: 'italic', marginBottom: '10px' }}>{q.questionEn}</p>}
            <div style={{ background: '#faf8f5', border: '1px solid #e5e0d8', borderRadius: '8px', padding: '12px', marginBottom: '10px' }}>
              <p style={{ fontSize: '11px', fontWeight: '600', color: '#888', marginBottom: '6px' }}>我的回答</p>
              <p style={{ fontSize: '13px', color: '#333', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>{q.userAnswer}</p>
            </div>
            {q.aiFeedback && (
              <div style={{ background: '#f5f7f5', border: '1px solid #c8d8cb', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
                <p style={{ fontSize: '11px', fontWeight: '600', color: '#5a7a60', marginBottom: '6px' }}>AI 評分回饋</p>
                <p style={{ fontSize: '12px', color: '#444', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{q.aiFeedback}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
