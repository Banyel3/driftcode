import { Navbar } from '@/components/navbar'
import { Hero } from '@/components/hero'
import { Features } from '@/components/features'
import { HowItWorks } from '@/components/how-it-works'
import { Providers } from '@/components/providers'
import { SelfHost } from '@/components/self-host'
import { GithubCta } from '@/components/github-cta'
import { Footer } from '@/components/footer'

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Providers />
        <SelfHost />
        <GithubCta />
      </main>
      <Footer />
    </>
  )
}
