import { redirect } from 'next/navigation'

// 登入前的 4 題偏好收集已經移除——WorkLog 統一改為登入後才開始使用。
//
// 原因：這頁不需要登入就能填，但資料庫的每筆資料都要掛在帳號底下，
// 所以當時只能先把答案暫存在瀏覽器 localStorage，等使用者登入後再搬進資料庫。
// 換裝置填寫就會搬不過去、被重問一次。登入後的 WelcomeModal 問的題目本來就
// 涵蓋這 4 題（而且還多問姓名），留兩套幾乎一樣的流程只會重複詢問。
//
// 這頁保留為轉址，避免既有連結或書籤 404；未登入者會被 proxy 擋到登入頁。
export default function OnboardingPage() {
  redirect('/dashboard')
}
