import { Competition } from "@/types";

export const competitions: Competition[] = [
  // STEM
  { id: "isef", name: "Intel ISEF", field: "STEM", difficulty: "Advanced", description: "The world's largest international pre-college science competition.", url: "https://www.societyforscience.org/isef/" },
  { id: "usamo", name: "USAMO", field: "Math", difficulty: "Advanced", description: "USA Mathematical Olympiad — the premier math competition for US students.", url: "https://maa.org/math-competitions/usa-mathematical-olympiad-usamo" },
  { id: "usaco", name: "USACO", field: "CS/Tech", difficulty: "Advanced", description: "USA Computing Olympiad — competitive programming for pre-college students.", url: "https://usaco.org/" },
  { id: "usabo", name: "USABO", field: "Biology", difficulty: "Advanced", description: "USA Biology Olympiad — top biology competition for high schoolers.", url: "https://www.usabo-trc.org/" },
  { id: "usapho", name: "USAPhO", field: "STEM", difficulty: "Advanced", description: "USA Physics Olympiad for high school students.", url: "https://www.aapt.org/physicsteam/" },
  { id: "usnco", name: "USNCO", field: "STEM", difficulty: "Advanced", description: "US National Chemistry Olympiad.", url: "https://www.acs.org/education/students/highschool/olympiad.html" },
  { id: "science-olympiad", name: "Science Olympiad", field: "STEM", difficulty: "Intermediate", description: "National STEM competition with 23 events across disciplines.", url: "https://www.soinc.org/" },
  { id: "mathcounts", name: "MATHCOUNTS", field: "Math", difficulty: "Beginner", description: "National math enrichment and competition program for middle school.", url: "https://www.mathcounts.org/" },
  { id: "amc", name: "AMC 10/12", field: "Math", difficulty: "Intermediate", description: "American Mathematics Competitions — gateway to AIME and USAMO.", url: "https://maa.org/math-competitions/amc-1012" },
  { id: "aime", name: "AIME", field: "Math", difficulty: "Advanced", description: "American Invitational Mathematics Examination.", url: "https://maa.org/math-competitions/aime" },
  { id: "mit-primes", name: "MIT PRIMES", field: "Math", difficulty: "Advanced", description: "Free year-long research program for high schoolers in math and CS.", url: "https://math.mit.edu/research/highschool/primes/" },
  { id: "rsi", name: "RSI (Research Science Institute)", field: "STEM", difficulty: "Advanced", description: "MIT's prestigious summer research program for high school students.", url: "https://www.cee.org/programs/research-science-institute" },
  // CS/Tech
  { id: "hackathons", name: "MLH Hackathons", field: "CS/Tech", difficulty: "Beginner", description: "Major League Hacking hackathon season with events worldwide.", url: "https://mlh.io/" },
  { id: "google-code-jam", name: "Google Code Jam", field: "CS/Tech", difficulty: "Intermediate", description: "Google's international coding competition.", url: "https://codingcompetitions.withgoogle.com/codejam" },
  { id: "codeforces", name: "Codeforces Competitions", field: "CS/Tech", difficulty: "Intermediate", description: "Online competitive programming platform with regular contests.", url: "https://codeforces.com/" },
  { id: "google-science-fair", name: "Google Science Fair", field: "STEM", difficulty: "Intermediate", description: "Global online science competition for ages 13-18.", url: "https://www.googlesciencefair.com/" },
  // Business
  { id: "deca", name: "DECA", field: "Business", difficulty: "Beginner", description: "International business competition for high school and college students.", url: "https://www.deca.org/" },
  { id: "fbla", name: "FBLA", field: "Business", difficulty: "Beginner", description: "Future Business Leaders of America competitions.", url: "https://www.fbla.org/" },
  { id: "diamond-challenge", name: "Diamond Challenge", field: "Business", difficulty: "Intermediate", description: "Entrepreneurship competition hosted by University of Delaware.", url: "https://diamondchallenge.org/" },
  { id: "nfte", name: "NFTE World Series of Innovation", field: "Business", difficulty: "Beginner", description: "Youth entrepreneurship challenge.", url: "https://www.nfte.com/worldseries/" },
  // Humanities/Writing
  { id: "debate-nsda", name: "NSDA National Tournament", field: "Humanities", difficulty: "Intermediate", description: "National Speech & Debate Association championship.", url: "https://www.speechanddebate.org/nationals/" },
  { id: "model-un", name: "Model United Nations", field: "Humanities", difficulty: "Beginner", description: "Simulated UN conferences developing diplomacy and public speaking.", url: "https://www.un.org/en/mun" },
  { id: "jshs", name: "JSHS", field: "STEM", difficulty: "Intermediate", description: "Junior Science and Humanities Symposium research competition.", url: "https://www.jshs.org/" },
  { id: "john-locke", name: "John Locke Essay Competition", field: "Humanities", difficulty: "Intermediate", description: "International essay competition in philosophy, politics, and economics.", url: "https://www.johnlockeinstitute.com/essay-competition" },
  { id: "concord-review", name: "The Concord Review", field: "Humanities", difficulty: "Advanced", description: "The only journal in the world to publish academic essays by high school students.", url: "https://tcr.org/" },
  { id: "ocean-awareness", name: "Ocean Awareness Contest", field: "Arts", difficulty: "Beginner", description: "Art and writing contest about environmental issues.", url: "https://bowseat.org/programs/ocean-awareness-contest/" },
  { id: "scholastic-writing", name: "Scholastic Art & Writing Awards", field: "Arts", difficulty: "Intermediate", description: "The longest-running recognition program for creative teens.", url: "https://www.artandwriting.org/" },
  // Arts/Music
  { id: "all-state", name: "All-State Orchestra/Band", field: "Arts", difficulty: "Intermediate", description: "State-level honor ensembles for talented musicians.", url: "#" },
  { id: "youths-arts", name: "National YoungArts Week", field: "Arts", difficulty: "Advanced", description: "Intensive program for YoungArts award winners.", url: "https://youngarts.org/" },
  { id: "congressional-art", name: "Congressional Art Competition", field: "Arts", difficulty: "Beginner", description: "Annual art competition for high schoolers by US Congress.", url: "https://www.house.gov/educators-and-students/congressional-art-competition" },
  // Research
  { id: "siemens-comp", name: "Siemens Competition", field: "STEM", difficulty: "Advanced", description: "Research competition for high school students in STEM.", url: "https://www.societyforscience.org/regeneron-sts/" },
  { id: "sts", name: "Regeneron STS", field: "STEM", difficulty: "Advanced", description: "Science Talent Search — the nation's most prestigious pre-college science competition.", url: "https://www.societyforscience.org/regeneron-sts/" },
  // Community
  { id: "presidents-volunteer", name: "President's Volunteer Service Award", field: "Community Service", difficulty: "Beginner", description: "National recognition for volunteer service.", url: "https://presidentialserviceawards.gov/" },
  { id: "jfk-profiles", name: "JFK Profile in Courage Essay Contest", field: "Humanities", difficulty: "Intermediate", description: "Essay contest about political courage.", url: "https://www.jfklibrary.org/learn/education/profile-in-courage-essay-contest" },
  { id: "laws-of-life", name: "Laws of Life Essay Contest", field: "Humanities", difficulty: "Beginner", description: "Essays about values and character.", url: "#" },
];
