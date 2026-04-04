"use client";

import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimeSlot {
  time: string;
  available: boolean;
}

interface DaySchedule {
  date: string;
  dayName: string;
  dayNumber: number;
  slots: TimeSlot[];
  hasAvailability: boolean;
}

interface Coach {
  name: string;
  title: string;
  location: string;
  rating: number;
  reviewCount: number;
  imageUrl: string;
}

interface CoachSchedulingProps {
  coach?: Coach;
  locations?: string[];
  weekSchedule?: DaySchedule[];
  onLocationChange?: (location: string) => void;
  onTimeSlotSelect?: (day: string, time: string) => void;
  onWeekChange?: (direction: "prev" | "next") => void;
  enableAnimations?: boolean;
  className?: string;
}

const defaultCoach: Coach = {
  name: "Michael Baumgardner",
  title: "Tennis coach",
  location: "New York",
  rating: 5.0,
  reviewCount: 7,
  imageUrl: "https://images.unsplash.com/photo-1660463532854-f887f2a6c674",
};

const defaultLocations = [
  "Riverbank State Park Tennis Courts",
  "Central Park Tennis Center",
  "Brooklyn Bridge Park Courts",
  "Prospect Park Tennis Center",
];

const defaultWeekSchedule: DaySchedule[] = [
  {
    date: "Aug 17",
    dayName: "Today",
    dayNumber: 17,
    hasAvailability: true,
    slots: [
      { time: "10:30 AM", available: true },
      { time: "11:00 AM", available: true },
      { time: "11:30 AM", available: true },
      { time: "12:00 PM", available: true },
      { time: "12:30 PM", available: true },
      { time: "01:00 PM", available: false },
      { time: "01:30 PM", available: true },
      { time: "02:00 PM", available: true },
      { time: "02:30 PM", available: true },
      { time: "03:00 PM", available: true },
    ],
  },
  {
    date: "Aug 18",
    dayName: "Tue",
    dayNumber: 18,
    hasAvailability: true,
    slots: [
      { time: "10:30 AM", available: true },
      { time: "11:00 AM", available: true },
      { time: "11:30 AM", available: true },
      { time: "12:00 PM", available: true },
      { time: "03:00 PM", available: true },
    ],
  },
  {
    date: "Aug 19",
    dayName: "Wed",
    dayNumber: 19,
    hasAvailability: true,
    slots: [
      { time: "11:00 AM", available: true },
      { time: "12:00 PM", available: true },
      { time: "12:30 PM", available: true },
      { time: "01:30 PM", available: false },
      { time: "02:00 PM", available: true },
      { time: "02:30 PM", available: true },
      { time: "03:00 PM", available: true },
    ],
  },
  {
    date: "Aug 20",
    dayName: "Thu",
    dayNumber: 20,
    hasAvailability: false,
    slots: [],
  },
  {
    date: "Aug 21",
    dayName: "Fri",
    dayNumber: 21,
    hasAvailability: false,
    slots: [],
  },
  {
    date: "Aug 22",
    dayName: "Sat",
    dayNumber: 22,
    hasAvailability: false,
    slots: [],
  },
];

export function CoachSchedulingCard({
  coach = defaultCoach,
  locations = defaultLocations,
  weekSchedule = defaultWeekSchedule,
  onLocationChange,
  onTimeSlotSelect,
  onWeekChange,
  enableAnimations = true,
  className,
}: CoachSchedulingProps) {
  const [selectedLocation, setSelectedLocation] = useState(locations[0]);
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const [weekRange] = useState("Aug 17 - Aug 22");
  const [showConfirmationView, setShowConfirmationView] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ day: string; time: string; dayName: string } | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const shouldAnimate = enableAnimations && !shouldReduceMotion;
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsLocationDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsLocationDropdownOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscapeKey);
    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, []);

  const handleLocationChange = (location: string) => {
    setSelectedLocation(location);
    setIsLocationDropdownOpen(false);
    onLocationChange?.(location);
  };

  const handleTimeSlotClick = (day: string, time: string) => {
    const dayInfo = weekSchedule.find(d => d.date === day);
    setSelectedTimeSlot({
      day,
      time,
      dayName: dayInfo?.dayName || day,
    });
    setShowConfirmationView(true);
    onTimeSlotSelect?.(day, time);
  };

  const handleBackToMain = () => {
    setShowConfirmationView(false);
    setSelectedTimeSlot(null);
  };

  const handleConfirmBooking = () => {
    setShowConfirmationView(false);
    setSelectedTimeSlot(null);
  };

  const handleWeekNavigation = (direction: "prev" | "next") => {
    onWeekChange?.(direction);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: {
      opacity: 0,
      x: -25,
      scale: 0.95,
      filter: "blur(4px)",
    },
    visible: {
      opacity: 1,
      x: 0,
      scale: 1,
      filter: "blur(0px)",
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 28,
        mass: 0.6,
      },
    },
  };

  const timeSlotVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 25,
      },
    },
  };

  return (
    <motion.div
      variants={shouldAnimate ? containerVariants : {}}
      initial={shouldAnimate ? "hidden" : "visible"}
      animate="visible"
      className={cn("bg-card relative max-w-2xl overflow-hidden rounded-xl border border-border/50 shadow-lg", className)}
    >
      <div className="relative h-auto">
        <motion.div
          initial={false}
          animate={{
            y: showConfirmationView ? "-20px" : "0px",
            opacity: showConfirmationView ? 0.3 : 1,
            scale: showConfirmationView ? 0.95 : 1,
          }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 30,
            mass: 0.8,
          }}
          className="w-full"
        >
          <motion.div variants={shouldAnimate ? itemVariants : {}} className="p-6 pb-6">
            <div className="flex items-start justify-between gap-6">
              <motion.div
                whileHover={
                  shouldAnimate
                    ? {
                        scale: 1.05,
                        transition: { type: "spring", stiffness: 400, damping: 25 },
                      }
                    : {}
                }
                className="flex-shrink-0"
              >
                <img src={coach.imageUrl} alt={coach.name} className="h-16 w-16 rounded-lg object-cover" />
              </motion.div>

              <div className="min-w-0 flex-1 space-y-4">
                <h2 className="text-xl font-semibold text-foreground">{coach.name}</h2>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-red-500 text-red-500" />
                    <span className="font-medium">{coach.rating}</span>
                    <motion.button
                      whileHover={
                        shouldAnimate
                          ? {
                              scale: 1.05,
                              transition: { type: "spring", stiffness: 400, damping: 25 },
                            }
                          : {}
                      }
                      className="hover:text-foreground underline transition-colors"
                    >
                      ({coach.reviewCount} reviews)
                    </motion.button>
                  </div>
                  <span>•</span>
                  <span>{coach.title}</span>
                  <span>•</span>
                  <span>{coach.location}</span>
                </div>
              </div>

              <motion.div
                initial={
                  shouldAnimate
                    ? {
                        opacity: 0,
                        scale: 0.8,
                        x: 20,
                        filter: "blur(4px)",
                      }
                    : {}
                }
                animate={
                  shouldAnimate
                    ? {
                        opacity: 1,
                        scale: 1,
                        x: 0,
                        filter: "blur(0px)",
                      }
                    : {}
                }
                transition={
                  shouldAnimate
                    ? {
                        type: "spring",
                        stiffness: 400,
                        damping: 25,
                        delay: 0.3,
                        mass: 0.6,
                      }
                    : {}
                }
                className="flex-shrink-0 text-right"
              >
                <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Per Session</p>
                <motion.p
                  className="text-2xl font-bold text-emerald-500"
                  initial={shouldAnimate ? { scale: 0.5 } : {}}
                  animate={shouldAnimate ? { scale: 1 } : {}}
                  transition={
                    shouldAnimate
                      ? {
                          type: "spring",
                          stiffness: 500,
                          damping: 20,
                          delay: 0.5,
                        }
                      : {}
                  }
                >
                  $75
                </motion.p>
              </motion.div>
            </div>
          </motion.div>

          <motion.div variants={shouldAnimate ? itemVariants : {}} className="relative z-50 px-6 pb-4" style={{ overflow: "visible" }}>
            <label className="mb-2 block text-sm text-muted-foreground">Choose location</label>
            <div className="relative z-50" ref={dropdownRef}>
              <motion.button
                whileHover={
                  shouldAnimate
                    ? {
                        scale: 1.01,
                        transition: { type: "spring", stiffness: 400, damping: 25 },
                      }
                    : {}
                }
                whileTap={shouldAnimate ? { scale: 0.99 } : {}}
                onClick={() => setIsLocationDropdownOpen(!isLocationDropdownOpen)}
                aria-expanded={isLocationDropdownOpen}
                aria-haspopup="listbox"
                className="bg-muted w-full rounded-lg border border-border/50 p-3 transition-colors hover:border-border"
              >
                <div className="flex items-center justify-between">
                  <span className="text-foreground">{selectedLocation}</span>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isLocationDropdownOpen && "rotate-180")} />
                </div>
              </motion.button>

              <AnimatePresence>
                {isLocationDropdownOpen && (
                  <motion.div
                    initial={shouldAnimate ? { opacity: 0, y: -10, scale: 0.95 } : {}}
                    animate={shouldAnimate ? { opacity: 1, y: 0, scale: 1 } : {}}
                    exit={shouldAnimate ? { opacity: 0, y: -10, scale: 0.95 } : {}}
                    transition={shouldAnimate ? { type: "spring", stiffness: 400, damping: 25 } : {}}
                    className="bg-card absolute left-0 right-0 top-full z-[9999] mt-2 overflow-hidden rounded-lg border border-border/50 shadow-xl"
                    role="listbox"
                  >
                    {locations.map((location, index) => (
                      <motion.button
                        key={location}
                        initial={shouldAnimate ? { opacity: 0, x: -10 } : {}}
                        animate={shouldAnimate ? { opacity: 1, x: 0 } : {}}
                        transition={shouldAnimate ? { delay: index * 0.05 } : {}}
                        whileHover={
                          shouldAnimate
                            ? {
                                backgroundColor: "hsl(var(--muted))",
                                transition: { duration: 0.15 },
                              }
                            : {}
                        }
                        onClick={() => handleLocationChange(location)}
                        role="option"
                        aria-selected={location === selectedLocation}
                        className="w-full p-3 text-left text-foreground transition-colors hover:bg-muted"
                      >
                        {location}
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          <motion.div variants={shouldAnimate ? itemVariants : {}} className="mx-6 border-t border-border/50" />

          <motion.div variants={shouldAnimate ? itemVariants : {}} className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <motion.button
                whileHover={
                  shouldAnimate
                    ? {
                        scale: 1.05,
                        transition: { type: "spring", stiffness: 400, damping: 25 },
                      }
                    : {}
                }
                whileTap={shouldAnimate ? { scale: 0.95 } : {}}
                onClick={() => handleWeekNavigation("prev")}
                aria-label="Previous week"
                className="rounded-lg p-2 transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <ChevronLeft className="h-5 w-5 text-muted-foreground" />
              </motion.button>

              <h3 className="font-semibold text-foreground">{weekRange}</h3>

              <motion.button
                whileHover={
                  shouldAnimate
                    ? {
                        scale: 1.05,
                        transition: { type: "spring", stiffness: 400, damping: 25 },
                      }
                    : {}
                }
                whileTap={shouldAnimate ? { scale: 0.95 } : {}}
                onClick={() => handleWeekNavigation("next")}
                aria-label="Next week"
                className="rounded-lg p-2 transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </motion.button>
            </div>
          </motion.div>

          <motion.div variants={shouldAnimate ? itemVariants : {}} className="space-y-4 px-6 pb-6">
            {weekSchedule.map(day => (
              <motion.div key={day.date} variants={shouldAnimate ? itemVariants : {}} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-foreground">
                      {day.dayName}, {day.date}
                    </h4>
                  </div>
                  {!day.hasAvailability && <span className="text-sm text-muted-foreground">No Availability</span>}
                </div>

                {day.hasAvailability && (
                  <motion.div variants={shouldAnimate ? containerVariants : {}} className="flex flex-wrap gap-2">
                    {day.slots.map(slot => (
                      <motion.button
                        key={`${day.date}-${slot.time}`}
                        variants={shouldAnimate ? timeSlotVariants : {}}
                        whileHover={
                          shouldAnimate && slot.available
                            ? {
                                scale: 1.05,
                                y: -2,
                                transition: { type: "spring", stiffness: 400, damping: 25 },
                              }
                            : {}
                        }
                        whileTap={shouldAnimate && slot.available ? { scale: 0.98 } : {}}
                        onClick={() => slot.available && handleTimeSlotClick(day.date, slot.time)}
                        disabled={!slot.available}
                        aria-label={`${slot.available ? "Book" : "Unavailable"} time slot at ${slot.time} on ${day.dayName}, ${day.date}`}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50",
                          slot.available
                            ? "bg-background cursor-pointer border-border/50 text-foreground hover:border-border hover:bg-muted"
                            : "bg-muted/50 cursor-not-allowed border-border/30 text-muted-foreground opacity-60"
                        )}
                      >
                        {slot.time}
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            ))}
          </motion.div>

          <motion.div variants={shouldAnimate ? itemVariants : {}} className="border-t border-border/50 p-6">
            <div className="flex gap-3">
              <motion.button
                whileHover={
                  shouldAnimate
                    ? {
                        scale: 1.02,
                        transition: { type: "spring", stiffness: 400, damping: 25 },
                      }
                    : {}
                }
                whileTap={shouldAnimate ? { scale: 0.98 } : {}}
                className="bg-muted hover:bg-muted/80 text-muted-foreground flex-1 rounded-lg py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                Cancel
              </motion.button>
              <motion.button
                whileHover={
                  shouldAnimate
                    ? {
                        scale: 1.02,
                        transition: { type: "spring", stiffness: 400, damping: 25 },
                      }
                    : {}
                }
                whileTap={shouldAnimate ? { scale: 0.98 } : {}}
                className="bg-primary hover:bg-primary/90 text-primary-foreground flex-1 rounded-lg py-2.5 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                Next
              </motion.button>
            </div>
          </motion.div>
        </motion.div>

        <motion.div
          initial={false}
          animate={{
            y: showConfirmationView ? "0%" : "100%",
            opacity: showConfirmationView ? 1 : 0,
          }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 30,
            mass: 0.8,
          }}
          className="bg-card absolute left-0 top-0 h-full w-full"
        >
          <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleBackToMain}
                className="text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm font-medium">Back</span>
              </motion.button>
              <h3 className="text-lg font-semibold text-foreground">Confirm Booking</h3>
              <div></div>
            </div>

            <div className="flex items-center gap-4 rounded-lg bg-muted/30 p-4">
              <img src={coach.imageUrl} alt={coach.name} className="h-12 w-12 rounded-lg object-cover" />
              <div>
                <h4 className="font-semibold text-foreground">{coach.name}</h4>
                <p className="text-sm text-muted-foreground">{coach.title}</p>
              </div>
            </div>

            {selectedTimeSlot && (
              <div className="space-y-4">
                <div className="text-center">
                  <p className="mb-2 text-sm uppercase tracking-wide text-muted-foreground">Your Booking</p>
                  <div className="rounded-lg border border-primary/20 bg-primary/10 p-4">
                    <p className="text-lg font-semibold text-foreground">
                      {selectedTimeSlot.dayName}, {selectedTimeSlot.day}
                    </p>
                    <p className="text-xl font-bold text-primary">{selectedTimeSlot.time}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground">Location:</span>
                    <span className="font-medium text-foreground">{selectedLocation}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground">Duration:</span>
                    <span className="font-medium text-foreground">1 hour</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground">Price:</span>
                    <span className="font-medium text-foreground">$75</span>
                  </div>
                </div>
              </div>
            )}

            <motion.button
              whileHover={shouldAnimate ? { scale: 1.02, y: -1 } : {}}
              whileTap={shouldAnimate ? { scale: 0.98 } : {}}
              onClick={handleConfirmBooking}
              className="group bg-primary hover:bg-primary/90 text-primary-foreground relative w-full cursor-pointer overflow-hidden rounded-lg border py-3 font-semibold transition-all duration-300"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                CONFIRM BOOKING
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[100%]" />
            </motion.button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
