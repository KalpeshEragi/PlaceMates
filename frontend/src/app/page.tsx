'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { 
  ArrowRight, 
  Sparkles, 
  Play, 
  CheckCircle2,
  FileText,
  Zap,
  Target,
  Star,
  Quote,
  Github,
  Clock,
  TrendingUp,
  Globe,
  Award
} from 'lucide-react'

function App() {
  const router = useRouter()
  const [isScrolled, setIsScrolled] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }

    window.addEventListener('scroll', handleScroll)
    window.addEventListener('mousemove', handleMouseMove)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  const features = [
    {
      title: 'Smart Profile Connect',
      description: 'Connect your GitHub and LinkedIn profiles. We automatically extract your experience, projects, and skills to build your career profile.',
      icon: Github,
      image: '/feature-resume.jpg',
      gradient: 'from-indigo-500/10 to-blue-500/10',
      iconBg: 'bg-indigo-100'
    },
    {
      title: 'AI Resume Builder',
      description: 'Generate a professional resume from your profile data. Our AI structures your experience and highlights your strengths.',
      icon: FileText,
      image: '/hero-mockup.jpg',
      gradient: 'from-teal-500/10 to-emerald-500/10',
      iconBg: 'bg-teal-100'
    },
    {
      title: 'Fresh Job Discovery',
      description: 'Discover opportunities posted within the last 24 hours. Our scraper monitors top job boards so you never miss a fresh opening.',
      icon: Clock,
      image: '/feature-interview.jpg',
      gradient: 'from-violet-500/10 to-purple-500/10',
      iconBg: 'bg-violet-100'
    },
    {
      title: 'Smart Job Matching',
      description: 'AI compares your profile with job descriptions to generate match scores. See which roles fit you best at a glance.',
      icon: Target,
      image: '/feature-community.jpg',
      gradient: 'from-amber-500/10 to-orange-500/10',
      iconBg: 'bg-amber-100'
    },
    {
      title: 'Resume Tailoring',
      description: 'For each high-match job, AI tailors your resume to match keywords and language—without inventing fake experience.',
      icon: Zap,
      image: '/feature-resume.jpg',
      gradient: 'from-rose-500/10 to-pink-500/10',
      iconBg: 'bg-rose-100'
    },
    {
      title: 'Portfolio Generator',
      description: 'Generate a clean, modern portfolio website in minutes. Choose from minimal, modern, or developer themes.',
      icon: Globe,
      image: '/hero-mockup.jpg',
      gradient: 'from-cyan-500/10 to-blue-500/10',
      iconBg: 'bg-cyan-100'
    },
  ]

  const workflows = [
    {
      step: '01',
      title: 'Job Ingestion',
      description: 'Every 6 hours, we scrape fresh jobs from LinkedIn and other sources using Apify.'
    },
    {
      step: '02',
      title: 'AI Processing',
      description: 'Keywords are extracted from job descriptions using LLM APIs for better matching.'
    },
    {
      step: '03',
      title: 'Smart Matching',
      description: 'Your profile is compared against job keywords to generate accurate match scores.'
    },
    {
      step: '04',
      title: 'Resume Tailoring',
      description: 'For jobs with >80% match, AI tailors your resume to highlight relevant experience.'
    },
  ]

  const testimonials = [
    {
      quote: "The job matching feature found roles I would have never discovered. Landed my dream job at a startup within 3 weeks!",
      author: "Sarah Chen",
      role: "Full Stack Developer",
      company: "TechStart Inc",
      avatar: "SC"
    },
    {
      quote: "Having my resume automatically tailored for each application saved me hours. The match scores helped me focus on the right opportunities.",
      author: "Marcus Johnson",
      role: "Product Manager",
      company: "ScaleUp Co",
      avatar: "MJ"
    },
    {
      quote: "The portfolio generator created a stunning website in minutes. Interviewers were impressed by my professional presence.",
      author: "Priya Sharma",
      role: "Data Scientist",
      company: "Analytics Pro",
      avatar: "PS"
    }
  ]

  const stats = [
    { value: '24h', label: 'Fresh Jobs' },
    { value: '95%', label: 'Match Accuracy' },
    { value: '10k+', label: 'Resumes Built' },
    { value: '4.9', label: 'User Rating', suffix: '/5' },
  ]

  return (
    <div className="min-h-screen bg-background overflow-x-hidden relative">
      {/* Dynamic Glow Background */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 opacity-40"
        style={{
          background: `radial-gradient(800px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(47, 79, 222, 0.08), transparent 50%)`
        }}
      />
      
      {/* Grid Pattern Overlay */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-grid-pattern opacity-50" />

      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled 
          ? 'bg-white/80 backdrop-blur-xl border-b border-indigo-100/50 shadow-sm' 
          : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="relative w-10 h-10 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-500/25 group-hover:scale-110 transition-transform duration-300">
              P
              <div className="absolute inset-0 bg-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="text-xl font-bold text-foreground">
              PlaceMate
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              Features
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              How It Works
            </a>
            <a href="#testimonials" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              Testimonials
            </a>
            <Button onClick={() => router.push('/Authentication')} className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-6 shadow-lg hover:shadow-xl transition-all duration-300">
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-44 lg:pb-32 overflow-hidden">
        {/* Decorative Gradient Orbs */}
        <div className="absolute top-32 left-10 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-[500px] h-[500px] bg-teal-400/15 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-300/10 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Content */}
            <div className="space-y-8 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium border border-indigo-100">
                <Sparkles className="w-4 h-4" />
                AI-Powered Job Acceleration
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
                Land Your Dream{' '}
                <span className="relative inline-block">
                  <span className="gradient-text">
                    Job Faster
                  </span>
                  <svg className="absolute -bottom-2 left-0 w-full h-3 text-indigo-200" viewBox="0 0 200 9" fill="none">
                    <path d="M2.00025 6.99997C25.7501 9.37499 111.525 -3.19999 198.001 6.99997" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-xl mx-auto lg:mx-0">
                Connect your profiles, discover fresh opportunities within 24 hours, and let AI tailor your resume for every application. Maximize your job search speed and personalization.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button onClick={() => router.push('/Authentication')} size="lg" className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-8 h-14 text-base shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-300 group">
                  Start Free Today
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button size="lg" variant="outline" className="rounded-full px-8 h-14 text-base border-2 border-indigo-100 hover:bg-indigo-50/50 hover:border-indigo-200 transition-all duration-300 group">
                  <Play className="mr-2 w-5 h-5 fill-current" />
                  Watch Demo
                </Button>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground justify-center lg:justify-start">
                <div className="flex -space-x-2">
                  {['bg-indigo-200', 'bg-teal-200', 'bg-violet-200', 'bg-amber-200'].map((bg, i) => (
                    <div key={i} className={`w-8 h-8 rounded-full ${bg} border-2 border-background flex items-center justify-center text-xs font-medium text-foreground/70`}>
                      {['JD', 'AK', 'MR', 'SL'][i]}
                    </div>
                  ))}
                </div>
                <p>Join 10,000+ job seekers</p>
              </div>
            </div>

            {/* Right Content - Hero Image */}
            <div className="relative lg:h-[550px] flex items-center justify-center">
              {/* Glow Behind Image */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/30 via-teal-500/20 to-violet-500/30 rounded-3xl blur-2xl scale-95" />
              
              {/* Main Image Container */}
              <div className="relative w-full max-w-lg">
                {/* Floating Decorative Elements */}
                <div className="absolute -top-6 -left-6 w-20 h-20 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-2xl rotate-12 opacity-20 animate-float-slow" />
                <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full opacity-20 animate-float-medium" />
                
                <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-indigo-500/10 border border-white/50">
                  <img
                    src="/hero-mockup.jpg"
                    alt="PlaceMate Dashboard"
                    className="w-full h-auto"
                  />
                </div>

                {/* Floating Cards */}
                <div className="absolute -left-8 top-1/4 bg-white p-4 rounded-2xl shadow-xl shadow-indigo-500/10 border border-indigo-50 animate-float-medium">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Resume Ready</p>
                      <p className="text-xs text-muted-foreground">95% ATS Optimized</p>
                    </div>
                  </div>
                </div>

                <div className="absolute -right-4 bottom-1/4 bg-white p-4 rounded-2xl shadow-xl shadow-indigo-500/10 border border-indigo-50 animate-float-slow">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                      <Target className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">92% Match</p>
                      <p className="text-xs text-muted-foreground">Senior Dev Role</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium">
              <Zap className="w-4 h-4" />
              Powerful Features
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
              Everything You Need to{' '}
              <span className="gradient-text">
                Accelerate
              </span>
            </h2>
            <p className="text-lg text-muted-foreground">
              From profile connection to job application—streamline your entire job search with AI.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="group relative overflow-hidden border-0 bg-white/60 backdrop-blur-sm hover:bg-white/80 transition-all duration-500 cursor-pointer hover-lift"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                <div className="relative p-6">
                  <div className="space-y-4">
                    <div className={`w-12 h-12 ${feature.iconBg} rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                      <feature.icon className="w-6 h-6 text-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold">{feature.title}</h3>
                    <p className="text-muted-foreground leading-relaxed text-sm">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/30 via-transparent to-teal-50/30" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-sm font-medium">
              <TrendingUp className="w-4 h-4" />
              Automation at Work
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
              How It{' '}
              <span className="gradient-text">Works</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Our n8n-powered workflows run 24/7 to keep your job search optimized.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {workflows.map((workflow, index) => (
              <div key={index} className="relative">
                <Card className="border-0 bg-white/70 backdrop-blur-sm hover:bg-white/90 transition-all duration-300 h-full">
                  <CardContent className="p-6 space-y-4">
                    <div className="text-4xl font-bold text-indigo-200">{workflow.step}</div>
                    <h3 className="text-lg font-semibold">{workflow.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {workflow.description}
                    </p>
                  </CardContent>
                </Card>
                {index < workflows.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-0.5 bg-indigo-200" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/50 via-transparent to-teal-50/50" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center space-y-2 group">
                <div className="text-3xl sm:text-4xl lg:text-5xl font-bold gradient-text group-hover:scale-110 transition-transform duration-300 inline-block">
                  {stat.value}{stat.suffix || ''}
                </div>
                <p className="text-muted-foreground font-medium text-sm sm:text-base">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Industry Insights Feature */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-sm font-medium">
                <Award className="w-4 h-4" />
                Weekly Insights
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Know Your{' '}
                <span className="gradient-text">Skills Gap</span>
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Every week, we analyze thousands of job postings to identify trending skills. Compare them with your profile and get actionable insights like:
              </p>
              <div className="space-y-4">
                {[
                  'Trending skills in your target roles',
                  'Skills you already have vs. market demand',
                  'Personalized learning recommendations',
                  'Salary insights based on skill combinations'
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                    </div>
                    <span className="text-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-teal-500/20 rounded-3xl blur-2xl" />
              <Card className="relative border-0 bg-white/80 backdrop-blur-sm shadow-xl">
                <CardContent className="p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">Your Skills vs Market</h3>
                    <span className="text-xs text-muted-foreground">Updated weekly</span>
                  </div>
                  <div className="space-y-4">
                    {[
                      { skill: 'React', have: true, demand: 95 },
                      { skill: 'TypeScript', have: true, demand: 88 },
                      { skill: 'Docker', have: false, demand: 82 },
                      { skill: 'AWS', have: false, demand: 78 },
                      { skill: 'GraphQL', have: true, demand: 65 },
                    ].map((item, i) => (
                      <div key={i} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className={item.have ? 'text-foreground' : 'text-muted-foreground'}>
                              {item.skill}
                            </span>
                            {!item.have && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                Missing
                              </span>
                            )}
                          </div>
                          <span className="text-muted-foreground">{item.demand}% demand</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ${
                              item.have ? 'bg-indigo-500' : 'bg-amber-400'
                            }`}
                            style={{ width: `${item.demand}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="pt-4 border-t border-indigo-50">
                    <p className="text-sm text-muted-foreground">
                      <span className="text-amber-600 font-medium">Tip:</span> Adding Docker and AWS to your resume could increase your match rate by 24%
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-sm font-medium">
              <Star className="w-4 h-4 fill-amber-500" />
              Success Stories
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
              Hired by{' '}
              <span className="gradient-text">Top Companies</span>
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-0 shadow-lg shadow-indigo-500/5 bg-white/70 backdrop-blur-sm hover:bg-white/90 transition-all duration-300 hover-lift">
                <CardContent className="p-6 sm:p-8 space-y-6">
                  <Quote className="w-8 h-8 text-indigo-200" />
                  <p className="text-foreground/90 leading-relaxed">"{testimonial.quote}"</p>
                  <div className="flex items-center gap-4 pt-4 border-t border-indigo-50">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white font-semibold">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{testimonial.author}</p>
                      <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                      <p className="text-xs text-indigo-600 font-medium">{testimonial.company}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-indigo-800" />
        
        {/* Decorative Elements */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-teal-400/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        
        {/* Dot Pattern */}
        <div className="absolute inset-0 opacity-10 bg-dot-pattern" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
            Ready to Accelerate Your Job Search?
          </h2>
          <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto">
            Join thousands of job seekers who use AI to discover opportunities, tailor resumes, and land their dream roles faster.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={() => router.push('/Authentication')} size="lg" className="bg-white text-indigo-600 hover:bg-white/90 rounded-full px-8 h-14 text-base shadow-2xl hover:shadow-white/25 transition-all duration-300 hover:-translate-y-0.5">
              Get Started Free
            </Button>
            <Button size="lg" variant="outline" className="border-2 border-white/30 text-white hover:bg-white/10 rounded-full px-8 h-14 text-base transition-all duration-300">
              View Pricing
            </Button>
          </div>
          <p className="text-sm text-white/60">No credit card required • Free plan includes 5 tailored resumes/month</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-indigo-100 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-lg flex items-center justify-center text-white font-bold">
                  P
                </div>
                <span className="text-xl font-bold text-foreground">PlaceMate</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                AI-powered job acceleration platform. Connect, discover, and apply with personalized resumes.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-foreground">Product</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-indigo-600 transition-colors">Resume Builder</a></li>
                <li><a href="#" className="hover:text-indigo-600 transition-colors">Job Matching</a></li>
                <li><a href="#" className="hover:text-indigo-600 transition-colors">Portfolio Generator</a></li>
                <li><a href="#" className="hover:text-indigo-600 transition-colors">Insights</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-foreground">Company</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-indigo-600 transition-colors">About</a></li>
                <li><a href="#" className="hover:text-indigo-600 transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-indigo-600 transition-colors">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-foreground">Support</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-indigo-600 transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-indigo-600 transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-indigo-600 transition-colors">Privacy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-indigo-100 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © 2024 PlaceMate. All rights reserved.
            </p>
            <div className="flex gap-6">
              <a href="#" className="text-muted-foreground hover:text-indigo-600 transition-colors text-sm">
                Twitter
              </a>
              <a href="#" className="text-muted-foreground hover:text-indigo-600 transition-colors text-sm">
                LinkedIn
              </a>
              <a href="#" className="text-muted-foreground hover:text-indigo-600 transition-colors text-sm">
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App